/**
 * PDF Renderer for Evidence Packs
 * Generates human-readable PDF documents
 */

import PDFDocument from 'pdfkit';
import type { EvidencePack } from './types.js';

/**
 * Render an evidence pack as a PDF buffer
 */
export async function renderPdf(pack: EvidencePack): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50,
                info: {
                    Title: `Evidence Pack - ${pack.subject.listing.id}`,
                    Author: 'Dar Real Estate',
                    Subject: 'Listing Evidence Pack',
                    Creator: 'Evidence Pack Generator',
                },
            });

            const chunks: Buffer[] = [];

            doc.on('data', (chunk: Buffer) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Title
            doc.fontSize(24)
                .font('Helvetica-Bold')
                .text('Listing Evidence Pack', { align: 'center' });
            doc.moveDown(0.5);

            // Generation info
            doc.fontSize(10)
                .font('Helvetica')
                .fillColor('#666666')
                .text(`Generated: ${pack.meta.generated_at}`, { align: 'center' });
            doc.text(`Pack Hash: ${pack.integrity.pack_hash}`, { align: 'center' });
            doc.moveDown(1.5);

            // Listing Summary
            doc.fillColor('#000000')
                .fontSize(16)
                .font('Helvetica-Bold')
                .text('Listing Summary');
            doc.moveDown(0.5);

            doc.fontSize(11)
                .font('Helvetica');

            const listing = pack.subject.listing;
            const summaryData = [
                ['ID', listing.id],
                ['Title', listing.title],
                ['Type', listing.type],
                ['Status', listing.status],
                ['Price', `${listing.price_currency} ${listing.price_amount?.toLocaleString() || 'N/A'}`],
                ['Bedrooms', listing.bedrooms?.toString() || 'N/A'],
                ['Bathrooms', listing.bathrooms?.toString() || 'N/A'],
                ['Size', listing.size_sqm ? `${listing.size_sqm} sqm` : 'N/A'],
                ['Address', listing.address_text || 'N/A'],
                ['Created', listing.created_at],
            ];

            for (const [label, value] of summaryData) {
                doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
                doc.font('Helvetica').text(String(value || 'N/A'));
            }

            doc.moveDown(1);

            // Poster Info
            doc.fontSize(16)
                .font('Helvetica-Bold')
                .text('Poster Information (Redacted)');
            doc.moveDown(0.5);

            doc.fontSize(11)
                .font('Helvetica');

            const poster = pack.subject.poster;
            doc.font('Helvetica-Bold').text('ID: ', { continued: true });
            doc.font('Helvetica').text(poster.id);
            doc.font('Helvetica-Bold').text('Name: ', { continued: true });
            doc.font('Helvetica').text(poster.name || 'N/A');
            doc.font('Helvetica-Bold').text('Phone: ', { continued: true });
            doc.font('Helvetica').text(poster.phone);
            doc.font('Helvetica-Bold').text('Email: ', { continued: true });
            doc.font('Helvetica').text(poster.email);

            doc.moveDown(1);

            // Media Manifest
            if (pack.subject.media_manifest.length > 0) {
                doc.fontSize(16)
                    .font('Helvetica-Bold')
                    .text('Media Manifest');
                doc.moveDown(0.5);

                doc.fontSize(10)
                    .font('Helvetica')
                    .fillColor('#666666')
                    .text('(URLs only - images not embedded for security)');
                doc.moveDown(0.3);

                doc.fillColor('#000000')
                    .fontSize(11);

                for (let i = 0; i < pack.subject.media_manifest.length; i++) {
                    const media = pack.subject.media_manifest[i];
                    doc.text(`${i + 1}. [${media.kind}] ${media.url}`);
                }

                doc.moveDown(1);
            }

            // Timeline
            doc.fontSize(16)
                .font('Helvetica-Bold')
                .text('Audit Timeline');
            doc.moveDown(0.5);

            if (pack.timeline.length === 0) {
                doc.fontSize(11)
                    .font('Helvetica-Oblique')
                    .text('No timeline entries found.');
            } else {
                doc.fontSize(9)
                    .font('Helvetica');

                // Table header
                doc.font('Helvetica-Bold');
                doc.text('Timestamp | Actor | Action', { underline: true });
                doc.moveDown(0.3);
                doc.font('Helvetica');

                for (const entry of pack.timeline.slice(0, 50)) { // Limit to 50 entries
                    const line = `${entry.ts} | ${entry.actor_type}:${entry.actor_id_redacted} | ${entry.action}`;

                    // Check if we need a new page
                    if (doc.y > 700) {
                        doc.addPage();
                    }

                    doc.text(line);
                }

                if (pack.timeline.length > 50) {
                    doc.moveDown(0.5);
                    doc.font('Helvetica-Oblique')
                        .text(`... and ${pack.timeline.length - 50} more entries (see JSON for complete timeline)`);
                }
            }

            doc.moveDown(1);

            // Reviews Summary
            if (pack.subject.reviews.length > 0) {
                doc.fontSize(16)
                    .font('Helvetica-Bold')
                    .text('Reviews');
                doc.moveDown(0.5);

                doc.fontSize(11)
                    .font('Helvetica');

                for (const review of pack.subject.reviews.slice(0, 10)) {
                    doc.font('Helvetica-Bold').text(`Rating: ${review.rating}/5`, { continued: true });
                    doc.font('Helvetica').text(` by ${review.reviewer_id_redacted} on ${review.created_at}`);
                    if (review.comment) {
                        doc.text(`"${review.comment.slice(0, 200)}${review.comment.length > 200 ? '...' : ''}"`);
                    }
                    doc.moveDown(0.3);
                }

                if (pack.subject.reviews.length > 10) {
                    doc.font('Helvetica-Oblique')
                        .text(`... and ${pack.subject.reviews.length - 10} more reviews`);
                }

                doc.moveDown(1);
            }

            // Integrity Info
            doc.fontSize(16)
                .font('Helvetica-Bold')
                .text('Integrity Information');
            doc.moveDown(0.5);

            doc.fontSize(10)
                .font('Courier');

            doc.text(`Pack Hash: ${pack.integrity.pack_hash}`);
            doc.text(`Timeline Hash Chain: ${pack.integrity.timeline_hash_chain}`);
            doc.moveDown(0.3);

            doc.font('Helvetica')
                .text(`Row Counts:`);
            doc.text(`  - Audit Log Entries: ${pack.integrity.row_count.audit_log}`);
            doc.text(`  - Reviews: ${pack.integrity.row_count.reviews}`);
            doc.text(`  - Viewings: ${pack.integrity.row_count.viewings}`);

            // Footer
            doc.moveDown(2);
            doc.fontSize(8)
                .fillColor('#999999')
                .text(
                    'This document was generated for compliance and audit purposes. ' +
                    'Personal data has been redacted. Verify integrity using pack_hash.',
                    { align: 'center' }
                );

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}
