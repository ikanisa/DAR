import { query } from '../db.js';

export async function getReviewQueue() {
    const result = await query(
        `SELECT l.id, l.title, u.full_name as poster_name, l.status, l.created_at
     FROM listings l
     LEFT JOIN users u ON l.poster_id = u.id
     WHERE l.status IN ('submitted', 'under_review')
     ORDER BY l.created_at ASC
     LIMIT 50`
    );

    return { listings: result.rows };
}
