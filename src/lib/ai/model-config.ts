import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type {
  AiCapability,
  AiModelRoutingFile,
  AiProviderConfig,
  AiRoutingSnapshot,
  AiSubjectKey,
  ResolvedModel,
} from './types';

interface CapabilityEntry {
  provider?: string;
  default: string;
  [subject: string]: string | undefined;
}

interface ParsedRoutingFile {
  providers: Record<string, AiProviderConfig>;
  defaultProvider: string;
  capabilities: Record<AiCapability, CapabilityEntry>;
}

const CAPABILITY_ENV_PREFIX: Record<AiCapability, string> = {
  subject_detect: 'SUBJECT_DETECT',
  vision_analyze: 'VISION',
  generate_similar: 'GENERATE',
  handwriting_remove: 'HANDWRITING',
};

const SUBJECT_ENV_KEY: Record<AiSubjectKey, string> = {
  math: 'MATH',
  chinese: 'CHINESE',
  english: 'ENGLISH',
  physics: 'PHYSICS',
  chemistry: 'CHEMISTRY',
  biology: 'BIOLOGY',
  science: 'SCIENCE',
  history: 'HISTORY',
  geography: 'GEOGRAPHY',
  politics: 'POLITICS',
  other: 'OTHER',
};

let cachedRouting: ParsedRoutingFile | null = null;
let cachedConfigPath: string | null = null;

function getConfigPath(): string {
  const custom = process.env.AI_MODEL_CONFIG?.trim();
  if (custom) {
    return custom.startsWith('/') ? custom : join(process.cwd(), custom);
  }
  return join(process.cwd(), 'config/ai-models.json');
}

function interpolateEnv(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, name: string) => process.env[name] ?? '');
}

function loadRoutingFile(): ParsedRoutingFile {
  const configPath = getConfigPath();
  if (cachedRouting && cachedConfigPath === configPath) {
    return cachedRouting;
  }

  if (!existsSync(configPath)) {
    throw new Error(`AI 模型配置文件不存在: ${configPath}`);
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as AiModelRoutingFile & {
    defaultProvider?: string;
    capabilities: Record<string, CapabilityEntry & { _comment?: string }>;
  };

  const providers: Record<string, AiProviderConfig> = {};
  for (const [name, provider] of Object.entries(raw.providers)) {
    providers[name] = {
      baseUrl: interpolateEnv(provider.baseUrl).replace(/\/$/, ''),
      apiKeyEnv: provider.apiKeyEnv,
    };
  }

  const capabilities = raw.capabilities as Record<AiCapability, CapabilityEntry>;
  cachedRouting = {
    providers,
    defaultProvider: raw.defaultProvider ?? 'default',
    capabilities,
  };
  cachedConfigPath = configPath;
  return cachedRouting;
}

/** 开发时热更换配置（修改 json 后调用） */
function reloadAiModelConfig(): void {
  cachedRouting = null;
  cachedConfigPath = null;
}

function parseModelRef(
  ref: string,
  capabilityProvider: string,
  routing: ParsedRoutingFile,
): { provider: string; model: string } {
  if (ref.includes(':')) {
    const [provider, model] = ref.split(':', 2);
    return { provider, model };
  }
  return { provider: capabilityProvider, model: ref };
}

function getEnvOverride(capability: AiCapability, subjectKey: AiSubjectKey): string | undefined {
  const cap = CAPABILITY_ENV_PREFIX[capability];
  const sub = SUBJECT_ENV_KEY[subjectKey];
  const specific = process.env[`AI_MODEL_${cap}_${sub}`]?.trim();
  if (specific) return specific;
  return process.env[`AI_MODEL_${cap}_DEFAULT`]?.trim();
}

function getEnvProviderOverride(
  capability: AiCapability,
  subjectKey: AiSubjectKey,
): string | undefined {
  const cap = CAPABILITY_ENV_PREFIX[capability];
  const sub = SUBJECT_ENV_KEY[subjectKey];
  return (
    process.env[`AI_PROVIDER_${cap}_${sub}`]?.trim() ||
    process.env[`AI_PROVIDER_${cap}`]?.trim()
  );
}

function getJsonEnvOverrides(): Record<string, Record<string, string>> {
  const raw = process.env.AI_MODEL_ROUTING_JSON?.trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, Record<string, string>>;
  } catch {
    console.warn('[ai] AI_MODEL_ROUTING_JSON 解析失败，已忽略');
    return {};
  }
}

function resolveModelRef(
  capability: AiCapability,
  subjectKey: AiSubjectKey,
): ResolvedModel | null {
  let routing: ParsedRoutingFile;
  try {
    routing = loadRoutingFile();
  } catch {
    return null;
  }

  const capEntry = routing.capabilities[capability];
  if (!capEntry) return null;

  const capabilityProvider = capEntry.provider ?? routing.defaultProvider;
  const jsonOverrides = getJsonEnvOverrides();
  const jsonCapOverrides = jsonOverrides[capability] ?? {};

  const envModel = getEnvOverride(capability, subjectKey);
  const jsonModel = jsonCapOverrides[subjectKey] ?? jsonCapOverrides.default;
  const fileModel = capEntry[subjectKey] ?? capEntry.default;

  const modelRef = envModel || jsonModel || fileModel;
  if (!modelRef || modelRef === 'disabled') {
    return null;
  }

  const envProvider = getEnvProviderOverride(capability, subjectKey);
  const { provider: parsedProvider, model } = parseModelRef(
    modelRef,
    envProvider ?? capabilityProvider,
    routing,
  );

  const providerConfig = routing.providers[parsedProvider];
  if (!providerConfig) {
    throw new Error(`未知 AI provider: ${parsedProvider}`);
  }

  const baseUrl = providerConfig.baseUrl;
  const apiKey = process.env[providerConfig.apiKeyEnv]?.trim() ?? '';
  if (!baseUrl || !apiKey) {
    throw new Error(
      `Provider「${parsedProvider}」未配置：需设置 ${providerConfig.apiKeyEnv} 与有效 baseUrl`,
    );
  }

  return {
    provider: parsedProvider,
    model,
    baseUrl,
    apiKey,
  };
}

function isAiConfigured(): boolean {
  try {
    return resolveModelRef('subject_detect', 'other') !== null;
  } catch {
    return false;
  }
}

function getAiRoutingSnapshot(): AiRoutingSnapshot {
  const configPath = getConfigPath();
  const envOverrides: string[] = [];
  for (const [key, value] of Object.entries(process.env)) {
    if (
      value &&
      (key.startsWith('AI_MODEL_') ||
        key.startsWith('AI_PROVIDER_') ||
        key === 'AI_MODEL_ROUTING_JSON' ||
        key === 'AI_MODEL_CONFIG')
    ) {
      envOverrides.push(`${key}=${key.includes('KEY') ? '***' : value}`);
    }
  }

  try {
    const routing = loadRoutingFile();
    const capabilities = {} as AiRoutingSnapshot['capabilities'];

    for (const capability of Object.keys(routing.capabilities) as AiCapability[]) {
      const entry = routing.capabilities[capability];
      const subjects: Record<string, string> = {};
      for (const [key, value] of Object.entries(entry)) {
        if (key === 'provider' || key === 'default' || key.startsWith('_')) continue;
        if (typeof value === 'string') subjects[key] = value;
      }
      capabilities[capability] = {
        default: entry.default,
        subjects,
      };
    }

    const active = resolveModelRef('subject_detect', 'other');
    return {
      configured: active !== null,
      configPath,
      activeProvider: active?.provider ?? routing.defaultProvider,
      capabilities,
      envOverrides,
    };
  } catch (error) {
    return {
      configured: false,
      configPath,
      activeProvider: 'unknown',
      capabilities: {
        subject_detect: { default: '', subjects: {} },
        vision_analyze: { default: '', subjects: {} },
        generate_similar: { default: '', subjects: {} },
        handwriting_remove: { default: '', subjects: {} },
      },
      envOverrides: [
        ...envOverrides,
        `error=${error instanceof Error ? error.message : 'unknown'}`,
      ],
    };
  }
}

/** 列出某能力下各学科实际将使用的模型（便于开发对比） */
function listResolvedModels(capability: AiCapability): Record<string, string> {
  const keys = Object.keys(SUBJECT_ENV_KEY) as AiSubjectKey[];
  const result: Record<string, string> = {};
  for (const key of keys) {
    try {
      const resolved = resolveModelRef(capability, key);
      result[key] = resolved ? `${resolved.provider}:${resolved.model}` : 'disabled';
    } catch (error) {
      result[key] = `error: ${error instanceof Error ? error.message : 'unknown'}`;
    }
  }
  return result;
}

export {
  getConfigPath,
  reloadAiModelConfig,
  resolveModelRef,
  isAiConfigured,
  getAiRoutingSnapshot,
  listResolvedModels,
};
