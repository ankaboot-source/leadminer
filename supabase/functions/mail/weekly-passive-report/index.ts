import PQueue from "p-queue";
import { createSupabaseAdmin } from "../../_shared/supabase.ts";
import weeklyMiningReportEmail from "../email-templates/weekly-report.ts";
import { getMiningStats, getUserEmail, getUserLanguage } from "../utils/db.ts";
import { sendEmail } from "../../_shared/mailing/email.ts";

interface ProcessingResult {
  userId: string;
  sent: boolean;
  email?: string;
  contactsCount?: number;
  reason?: string;
  error?: string;
}

interface MiningTaskStats {
  totalContacts: number;
  totalReachable: number;
  totalWithPhone: number;
  totalWithCompany: number;
  totalWithLocation: number;
}

interface PassiveMiningResult {
  user_id: string;
  mining_id: string;
}

const supabase = createSupabaseAdmin();

/**
 * Aggregate stats from multiple mining IDs
 */
async function aggregateMiningStats(miningIds: string[]): Promise<MiningTaskStats> {
  const stats: MiningTaskStats = {
    totalContacts: 0,
    totalReachable: 0,
    totalWithPhone: 0,
    totalWithCompany: 0,
    totalWithLocation: 0
  };
  
  console.debug(`[aggregateMiningStats] Aggregating stats for ${miningIds.length} mining IDs`);
  
  for (const miningId of miningIds) {
    try {
      const miningStats = await getMiningStats(miningId);
      
      stats.totalContacts += miningStats.total_contacts_mined || 0;
      stats.totalReachable += miningStats.total_reachable || 0;
      stats.totalWithPhone += miningStats.total_with_phone || 0;
      stats.totalWithCompany += miningStats.total_with_company || 0;
      stats.totalWithLocation += miningStats.total_with_location || 0;
    } catch (error) {
      console.error(`[aggregateMiningStats] Failed to get stats for mining ${miningId}:`, error);
    }
  }
  
  console.debug(`[aggregateMiningStats] Aggregated stats: ${JSON.stringify(stats)}`);
  return stats;
}

/**
 * Get passive mining IDs for a given date range
 */
async function getPassiveMiningIds(weekStart: Date, weekEnd: Date): Promise<PassiveMiningResult[]> {
  const { data, error } = await supabase
    .schema('private')
    .rpc('get_passive_mining_ids', {
      week_start: weekStart,
      week_end: weekEnd
    });

  if (error) {
    console.error('[getPassiveMiningIds] Failed to fetch passive mining IDs:', error);
    throw error;
  }

  return data as PassiveMiningResult[];
}

/**
 * Send weekly passive mining reports to all users with passive_mining enabled
 */
export default async function sendWeeklyPassiveMiningReports(weekStart: string) {

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  console.debug(`[sendWeeklyPassiveMiningReports] Reporting period: ${weekStart} to ${weekEndStr}`);

  let emailsSent = 0;
  const results: ProcessingResult[] = [];
  const queue = new PQueue({ concurrency: 5 });
  const userToMiningIds = new Map<string, string[]>();

  (await getPassiveMiningIds(new Date(weekStart), weekEnd)).forEach(({user_id, mining_id}) => {
    const stored = [...(userToMiningIds.get(user_id) ?? []), mining_id]
    userToMiningIds.set(user_id, stored);
  })

  for (const [userId, miningIds] of userToMiningIds.entries()) {
    queue.add(async () => {
      console.debug(`[sendWeeklyPassiveMiningReports] Processing user ${userId}`);
      try {        
        const stats = await aggregateMiningStats(miningIds);
        
        if (stats.totalContacts === 0) {
          console.log(`[sendWeeklyPassiveMiningReports] No contacts mined for user ${userId} this week`);
          results.push({ userId, sent: false, reason: 'no_contacts' });
          return;
        }
        
        const [email, language] = await Promise.all([
          getUserEmail(userId),
          getUserLanguage(userId)
        ]);
        
        if (!email) {
          console.warn(`[sendWeeklyPassiveMiningReports] No email found for user ${userId}`);
          results.push({ userId, sent: false, reason: 'no_email' });
          return;
        }
        
        const { html, subject } = weeklyMiningReportEmail(
          stats.totalContacts,
          stats.totalReachable,
          stats.totalWithPhone,
          stats.totalWithCompany,
          stats.totalWithLocation,
          language,
        );
        
        await sendEmail(email, subject, html);
        
        console.log(`[sendWeeklyPassiveMiningReports] Weekly passive report sent to ${email} (${stats.totalContacts} contacts)`);
        results.push({
          userId, 
          sent: true, 
          email,
          contactsCount: stats.totalContacts 
        });
        emailsSent++;
        
      } catch (error) {
        console.error(`[sendWeeklyPassiveMiningReports] Failed to process user ${userId}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({ 
          userId, 
          sent: false, 
          error: errorMessage 
        });
      }
    });
  }
  
  await queue.onIdle();
  
  console.log(`[sendWeeklyPassiveMiningReports] Weekly passive mining report job completed. Processed: ${userToMiningIds.size}, Emails sent: ${emailsSent}`);
  
  return {
    processed: userToMiningIds.size,
    emailsSent,
    results
  };
}
