import { SupabaseClient } from '@supabase/supabase-js';

async function adjustPoints(
  admin: SupabaseClient,
  profileId: string,
  amount: number,
  type: string,
  referenceType: string,
  referenceId: string,
  description: string,
): Promise<{ balance: number }> {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('points_balance')
    .eq('id', profileId)
    .single();

  if (profileError || !profile) {
    throw new Error('用户不存在');
  }

  const nextBalance = profile.points_balance + amount;
  if (nextBalance < 0) {
    throw new Error('积分不足');
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update({ points_balance: nextBalance })
    .eq('id', profileId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: txError } = await admin.from('point_transactions').insert({
    profile_id: profileId,
    amount,
    type,
    reference_type: referenceType,
    reference_id: referenceId,
    description,
  });

  if (txError) {
    throw new Error(txError.message);
  }

  return { balance: nextBalance };
}

function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'V-';
  for (let i = 0; i < 8; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export { adjustPoints, generateVoucherCode };
