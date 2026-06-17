import {
  pgTable,
  serial,
  timestamp,
  varchar,
  integer,
  uuid,
  text,
  index,
  boolean,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const families = pgTable('families', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 100 }).notNull(),
  created_by: uuid('created_by'),
  writeoff_salt: varchar('writeoff_salt', { length: 64 }),
  writeoff_password_hash: varchar('writeoff_password_hash', { length: 128 }),
  created_at: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey(),
    role: varchar('role', { length: 20 }).notNull().default('student'),
    family_id: uuid('family_id')
      .notNull()
      .references(() => families.id),
    name: varchar('name', { length: 100 }).notNull(),
    username: varchar('username', { length: 30 }),
    points_balance: integer('points_balance').notNull().default(0),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }),
  },
  (table) => [
    index('profiles_family_id_idx').on(table.family_id),
    index('profiles_role_idx').on(table.role),
    index('profiles_username_idx').on(table.username),
  ],
);

export const homeworks = pgTable(
  'homeworks',
  {
    id: serial().primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    subject: varchar('subject', { length: 50 }).notNull(),
    deadline: timestamp('deadline', { withTimezone: true }),
    estimated_minutes: integer('estimated_minutes').notNull().default(30),
    family_id: uuid('family_id')
      .notNull()
      .references(() => families.id),
    created_by: uuid('created_by')
      .notNull()
      .references(() => profiles.id),
    assigned_to: uuid('assigned_to').references(() => profiles.id),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    points: integer('points').notNull().default(0),
    review_status: varchar('review_status', { length: 20 }).notNull().default('none'),
    reviewed_at: timestamp('reviewed_at', { withTimezone: true }),
    reviewed_by: uuid('reviewed_by'),
    started_at: timestamp('started_at', { withTimezone: true }),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }),
  },
  (table) => [
    index('homeworks_family_id_idx').on(table.family_id),
    index('homeworks_created_by_idx').on(table.created_by),
    index('homeworks_assigned_to_idx').on(table.assigned_to),
    index('homeworks_status_idx').on(table.status),
    index('homeworks_deadline_idx').on(table.deadline),
  ],
);

export const homeworkMedia = pgTable(
  'homework_media',
  {
    id: serial().primaryKey(),
    homework_id: integer('homework_id')
      .notNull()
      .references(() => homeworks.id, { onDelete: 'cascade' }),
    file_path: text('file_path').notNull(),
    media_type: varchar('media_type', { length: 20 }).notNull(),
    uploaded_by: uuid('uploaded_by').notNull(),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('homework_media_homework_id_idx').on(table.homework_id)],
);

export const gifts = pgTable(
  'gifts',
  {
    id: serial().primaryKey(),
    family_id: uuid('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    points_cost: integer('points_cost').notNull(),
    is_active: boolean('is_active').notNull().default(true),
    created_by: uuid('created_by').notNull(),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('gifts_family_id_idx').on(table.family_id)],
);

export const vouchers = pgTable(
  'vouchers',
  {
    id: serial().primaryKey(),
    gift_id: integer('gift_id')
      .notNull()
      .references(() => gifts.id, { onDelete: 'cascade' }),
    student_id: uuid('student_id').notNull(),
    family_id: uuid('family_id').notNull(),
    code: varchar('code', { length: 32 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    points_spent: integer('points_spent').notNull(),
    redeemed_at: timestamp('redeemed_at', { withTimezone: true }),
    redeemed_by: uuid('redeemed_by'),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('vouchers_student_id_idx').on(table.student_id),
    index('vouchers_family_id_idx').on(table.family_id),
  ],
);

export const pointTransactions = pgTable(
  'point_transactions',
  {
    id: serial().primaryKey(),
    profile_id: uuid('profile_id').notNull(),
    amount: integer('amount').notNull(),
    type: varchar('type', { length: 40 }).notNull(),
    reference_type: varchar('reference_type', { length: 40 }),
    reference_id: varchar('reference_id', { length: 64 }),
    description: text('description'),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('point_transactions_profile_id_idx').on(table.profile_id)],
);
