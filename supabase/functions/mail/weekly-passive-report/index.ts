import PQueue from "p-queue";
import { createSupabaseAdmin } from "../../_shared/supabase.ts";
import weeklyMiningReportEmail from "../email-templates/weekly-report.ts";
import { getMiningStats, getUserEmail, getUserLanguage } from "../utils/db.ts";
import { sendEmail } from "../utils/email.ts";

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

const supabase = createSupabaseAdmin();

/**
 * Get mining IDs from passive mining tasks for a user in a given week
 */
async function getMiningIdsForUser(
  userId: string, 
  weekStart: string, 
  weekEndStr: string
): Promise<string[]> {
  const { data, error } = await supabase
    .schema("private")
    .from('tasks')
    .select('details->>miningId')
    .eq('user_id', userId)
    .eq('type', 'fetch')
    .eq('status', 'done')
    .eq('details->>passive_mining', 'true')
    .gte('stopped_at', weekStart)
    .lt('stopped_at', weekEndStr);

  if (error) {
    console.error(`[getMiningIdsForUser] Failed to fetch mining IDs for user ${userId}: ${error.message}`);
    throw new Error(`Failed to fetch mining IDs: ${error.message}`);
  }
  
  const miningIds = (data as {miningId: string}[])
    ?.map(({ miningId }) => miningId)
    .filter(Boolean) || [];
  
  console.debug(`[getMiningIdsForUser] Found ${miningIds.length} mining IDs for user ${userId}`);
  return miningIds;
}

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
 * Get unique user IDs with passive_mining enabled
 */
async function getUsersWithPassiveMining(): Promise<string[]> {
  const { data, error } = await supabase
    .schema("private")
    .from('mining_sources')
    .select('user_id')
    .eq('passive_mining', true)
    .limit(1000);
  
  if (error) {
    console.error('[getUsersWithPassiveMining] Failed to fetch users with passive_mining:', error);
    throw error;
  }
  
  if (!data || data.length === 0) {
    console.log('[getUsersWithPassiveMining] No users with passive_mining enabled found');
    return [];
  }

  const miningSources = data as {user_id: string}[];
  const uniqueUserIds = [...new Set(miningSources.map(u => u.user_id))];
  console.log(`[getUsersWithPassiveMining] Found ${uniqueUserIds.length} unique users with passive_mining enabled`);
  return uniqueUserIds;
}

/**
 * Send weekly passive mining reports to all users with passive_mining enabled
 */
export default async function sendWeeklyPassiveMiningReports(weekStart: string) {
  console.log(`[sendWeeklyPassiveMiningReports] Starting weekly passive mining report job for week starting ${weekStart}`);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  console.debug(`[sendWeeklyPassiveMiningReports] Reporting period: ${weekStart} to ${weekEndStr}`);

  const uniqueUserIds = await getUsersWithPassiveMining();
  
  if (uniqueUserIds.length === 0) {
    console.log('[sendWeeklyPassiveMiningReports] No users with passive_mining enabled');
    return { processed: 0, emailsSent: 0, results: [] };
  }
  
  console.log(`[sendWeeklyPassiveMiningReports] Processing ${uniqueUserIds.length} users`);

  let emailsSent = 0;
  const results: ProcessingResult[] = [];
  const queue = new PQueue({ concurrency: 5 });
  
  for (const userId of uniqueUserIds) {
    queue.add(async () => {
      console.debug(`[sendWeeklyPassiveMiningReports] Processing user ${userId}`);
      
      try {
        const miningIds = await getMiningIdsForUser(userId, weekStart, weekEndStr);
        
        if (miningIds.length === 0) {
          console.log(`[sendWeeklyPassiveMiningReports] No passive mining tasks for user ${userId} this week`);
          results.push({ userId, sent: false, reason: 'no_tasks' });
          return;
        }
        
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
  
  console.log(`[sendWeeklyPassiveMiningReports] Weekly passive mining report job completed. Processed: ${uniqueUserIds.length}, Emails sent: ${emailsSent}`);
  
  return {
    processed: uniqueUserIds.length,
    emailsSent,
    results
  };
}
