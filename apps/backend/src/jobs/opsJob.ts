
import cron from 'node-cron';
import { generateWeeklyBrief } from '../reports/weeklyMarketBrief.js';
import { detectAnomalies } from '../reports/anomalyDetector.js';

// Weekly brief: every Monday at 8 AM Malta time
export function scheduleOpsJobs(): void {
    // Check if we are in a testing environment or explicit disable
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_CRON === 'true') {
        return;
    }

    console.log('Scheduling Ops Jobs...');

    cron.schedule('0 8 * * 1', () => {
        console.log('Starting Weekly Market Brief generation job...');
        generateWeeklyBrief()
            .then(() => console.log('Weekly Market Brief generated successfully.'))
            .catch(err => console.error('Weekly Market Brief generation failed:', err));
    }, { timezone: 'Europe/Malta' });

    // Anomaly detection: daily at midnight
    cron.schedule('0 0 * * *', () => {
        console.log('Starting Daily Anomaly Detection job...');
        detectAnomalies()
            .then(anomalies => console.log(`Anomaly Detection completed. Found ${anomalies.length} anomalies.`))
            .catch(err => console.error('Anomaly Detection failed:', err));
    }, { timezone: 'Europe/Malta' });
}
