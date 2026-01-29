/**
 * Moltbot Output Contract Validation
 *
 * Validates agent outputs against JSON Schema contracts using Zod.
 * Used by the chat orchestration layer to ensure agent responses are safe to execute.
 */

import { z } from 'zod';

// ============================================================================
// Seeker/Poster Agent Actions
// ============================================================================

export const SeekerActions = [
    'ask_user',
    'search_properties',
    'refine_criteria',
    'show_shortlist',
    'create_draft',
    'update_draft',
    'submit_for_review',
    'schedule_viewing',
    'inquire_listing',
    'show_listing_details',
    'save_to_favorites',
    'notify_poster',
] as const;

export type SeekerAction = (typeof SeekerActions)[number];

// ============================================================================
// Admin Agent Actions
// ============================================================================

export const AdminActions = [
    'ask_user',
    'approve_listing',
    'reject_listing',
    'request_changes',
    'flag_moderation',
    'view_queue',
    'view_listing_details',
    'escalate',
    'unblock_user',
    'suspend_user',
    'update_listing_status',
    'risk_override',
] as const;

export type AdminAction = (typeof AdminActions)[number];

// ============================================================================
// Ingestion Agent Actions (Property Discovery + Sync)
// ============================================================================

export const IngestionActions = [
    'discover_properties',      // Search for properties using AI web search
    'ingest_listings',          // Insert/update listings into database
    'get_feed_sources',         // Get list of property sources to search
    'get_pending_jobs',         // Get jobs from queue
    'complete_job',             // Mark a job as done
    'get_listing_stats',        // Get current listing statistics
    'report_status',            // Report back to user/admin
] as const;

export type IngestionAction = (typeof IngestionActions)[number];

// ============================================================================
// Shared Schemas
// ============================================================================

const UUIDSchema = z.string().uuid();

const CriteriaSchema = z.object({
    location: z.string().optional(),
    min_price: z.number().min(0).optional(),
    max_price: z.number().min(0).optional(),
    bedrooms: z.number().int().min(0).optional(),
    bathrooms: z.number().int().min(0).optional(),
    property_type: z
        .enum([
            'apartment',
            'house',
            'villa',
            'penthouse',
            'studio',
            'maisonette',
            'farmhouse',
            'other',
        ])
        .optional(),
    features: z.array(z.string()).optional(),
});

const CandidateSchema = z.object({
    listing_id: UUIDSchema,
    title: z.string(),
    price: z.number().optional(),
    location: z.string().optional(),
    match_score: z.number().min(0).max(1).optional(),
    match_reasons: z.array(z.string()).optional(),
});

const ViewingSchema = z.object({
    listing_id: UUIDSchema,
    proposed_dates: z.array(z.string().datetime()).optional(),
    notes: z.string().max(500).optional(),
});

const InquirySchema = z.object({
    listing_id: UUIDSchema,
    message: z.string().max(1000).optional(),
    contact_preference: z.enum(['email', 'phone', 'whatsapp', 'in_app']).optional(),
});

// ============================================================================
// Seeker/Poster Output Schema
// ============================================================================

const SeekerParamsSchema = z.object({
    message: z.string().max(2000).optional(),
    listing_id: UUIDSchema.optional(),
    draft_id: UUIDSchema.optional(),
    criteria: CriteriaSchema.optional(),
    patch: z.record(z.unknown()).optional(),
    candidates: z.array(CandidateSchema).max(20).optional(),
    viewing: ViewingSchema.optional(),
    inquiry: InquirySchema.optional(),
});

export const SeekerOutputSchema = z
    .object({
        thought: z.string().min(10).max(500),
        action: z.enum(SeekerActions),
        params: SeekerParamsSchema,
    })
    .superRefine((data, ctx) => {
        // Conditional validation based on action
        switch (data.action) {
            case 'ask_user':
            case 'show_listing_details':
                if (!data.params.message) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Action '${data.action}' requires 'message' in params`,
                        path: ['params', 'message'],
                    });
                }
                break;
            case 'search_properties':
            case 'refine_criteria':
                if (!data.params.criteria) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Action '${data.action}' requires 'criteria' in params`,
                        path: ['params', 'criteria'],
                    });
                }
                break;
            case 'show_shortlist':
                if (!data.params.candidates || !data.params.message) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Action 'show_shortlist' requires 'candidates' and 'message' in params",
                        path: ['params'],
                    });
                }
                break;
            case 'update_draft':
                if (!data.params.draft_id || !data.params.patch) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Action 'update_draft' requires 'draft_id' and 'patch' in params",
                        path: ['params'],
                    });
                }
                break;
            case 'submit_for_review':
                if (!data.params.draft_id) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Action 'submit_for_review' requires 'draft_id' in params",
                        path: ['params', 'draft_id'],
                    });
                }
                break;
            case 'schedule_viewing':
                if (!data.params.viewing) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Action 'schedule_viewing' requires 'viewing' in params",
                        path: ['params', 'viewing'],
                    });
                }
                break;
            case 'inquire_listing':
                if (!data.params.inquiry) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Action 'inquire_listing' requires 'inquiry' in params",
                        path: ['params', 'inquiry'],
                    });
                }
                break;
        }
    });

export type SeekerOutput = z.infer<typeof SeekerOutputSchema>;

// ============================================================================
// Admin Output Schema
// ============================================================================

const ChangeRequestSchema = z.object({
    field: z.string(),
    issue: z.string(),
    suggestion: z.string().optional(),
});

const QueueFilterSchema = z.object({
    status: z.enum(['pending', 'moderation_hold', 'changes_requested', 'all']).optional(),
    priority: z.enum(['newest', 'oldest', 'high_value']).optional(),
    limit: z.number().int().min(1).max(50).default(10).optional(),
});

const QueueItemSchema = z.object({
    listing_id: UUIDSchema,
    title: z.string(),
    status: z.string(),
    submitted_at: z.string().datetime().optional(),
    poster_id: UUIDSchema.optional(),
    flags: z.array(z.string()).optional(),
});

const AdminParamsSchema = z.object({
    message: z.string().max(2000).optional(),
    listing_id: UUIDSchema.optional(),
    user_id: UUIDSchema.optional(),
    reason: z.string().max(500).optional(),
    notes: z.string().max(1000).optional(),
    changes_requested: z.array(ChangeRequestSchema).optional(),
    moderation_category: z
        .enum(['spam', 'inappropriate', 'misleading', 'duplicate', 'low_quality', 'suspicious', 'other'])
        .optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    queue_filter: QueueFilterSchema.optional(),
    queue_items: z.array(QueueItemSchema).optional(),
    new_status: z
        .enum(['draft', 'pending', 'approved', 'rejected', 'moderation_hold', 'archived'])
        .optional(),
    suspension_duration: z.enum(['1d', '7d', '30d', 'permanent']).optional(),
    decision: z.enum(['allow', 'hold', 'reject']).optional(),
});

export const AdminOutputSchema = z
    .object({
        thought: z.string().min(10).max(500),
        action: z.enum(AdminActions),
        params: AdminParamsSchema,
    })
    .superRefine((data, ctx) => {
        switch (data.action) {
            case 'ask_user':
                if (!data.params.message) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Action 'ask_user' requires 'message' in params",
                        path: ['params', 'message'],
                    });
                }
                break;
            case 'approve_listing':
            case 'view_listing_details':
                if (!data.params.listing_id) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Action '${data.action}' requires 'listing_id' in params`,
                        path: ['params', 'listing_id'],
                    });
                }
                break;
            case 'reject_listing':
                if (!data.params.listing_id || !data.params.reason) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Action 'reject_listing' requires 'listing_id' and 'reason' in params",
                        path: ['params'],
                    });
                }
                break;
            case 'request_changes':
                if (!data.params.listing_id || !data.params.changes_requested) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message:
                            "Action 'request_changes' requires 'listing_id' and 'changes_requested' in params",
                        path: ['params'],
                    });
                }
                break;
            case 'flag_moderation':
                if (!data.params.listing_id || !data.params.moderation_category || !data.params.reason) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message:
                            "Action 'flag_moderation' requires 'listing_id', 'moderation_category', and 'reason' in params",
                        path: ['params'],
                    });
                }
                break;
            case 'escalate':
                if (!data.params.listing_id || !data.params.severity || !data.params.reason) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Action 'escalate' requires 'listing_id', 'severity', and 'reason' in params",
                        path: ['params'],
                    });
                }
                break;
            case 'suspend_user':
                if (!data.params.user_id || !data.params.reason || !data.params.suspension_duration) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message:
                            "Action 'suspend_user' requires 'user_id', 'reason', and 'suspension_duration' in params",
                        path: ['params'],
                    });
                }
                break;
            case 'update_listing_status':
                if (!data.params.listing_id || !data.params.new_status) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Action 'update_listing_status' requires 'listing_id' and 'new_status' in params",
                        path: ['params'],
                    });
                }
                break;
            case 'risk_override':
                if (!data.params.listing_id || !data.params.decision) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Action 'risk_override' requires 'listing_id' and 'decision' in params",
                        path: ['params'],
                    });
                }
                break;
        }
    });

export type AdminOutput = z.infer<typeof AdminOutputSchema>;

// ============================================================================
// Ingestion Agent Output Schema
// ============================================================================

const ListingSchema = z.object({
    title: z.string(),
    link: z.string().url(),
    summary: z.string().optional(),
    image_url: z.string().optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
    location: z.string().optional(),
    type: z.string().optional(),
    bedrooms: z.number().optional(),
    bathrooms: z.number().optional(),
    size_sqm: z.number().optional(),
    source: z.string().optional(),
    source_url: z.string().optional(),
});

const IngestionParamsSchema = z.object({
    message: z.string().max(2000).optional(),
    query: z.string().optional(),
    source: z.string().optional(),
    location: z.string().optional(),
    property_type: z.string().optional(),
    min_price: z.number().optional(),
    max_price: z.number().optional(),
    bedrooms: z.number().optional(),
    limit: z.number().optional(),
    listings: z.array(ListingSchema).optional(),
    job_id: z.string().uuid().optional(),
    url: z.string().optional(),
});

export const IngestionOutputSchema = z
    .object({
        thought: z.string().min(10).max(500),
        action: z.enum(IngestionActions),
        params: IngestionParamsSchema,
    })
    .superRefine((data, ctx) => {
        switch (data.action) {
            case 'ingest_listings':
                if (!data.params.listings || data.params.listings.length === 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Action 'ingest_listings' requires 'listings' array in params",
                        path: ['params', 'listings'],
                    });
                }
                break;
            case 'complete_job':
                if (!data.params.job_id) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Action 'complete_job' requires 'job_id' in params",
                        path: ['params', 'job_id'],
                    });
                }
                break;
            case 'report_status':
                if (!data.params.message) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Action 'report_status' requires 'message' in params",
                        path: ['params', 'message'],
                    });
                }
                break;
        }
    });

export type IngestionOutput = z.infer<typeof IngestionOutputSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

export type ContractType = 'seeker' | 'admin' | 'ingestion';

export interface ValidationResult {
    valid: boolean;
    errors?: string[];
    data?: SeekerOutput | AdminOutput | IngestionOutput;
}

/**
 * Validate agent output against the appropriate contract schema.
 *
 * @param output - The raw agent output (parsed JSON)
 * @param contractType - Which contract to validate against ('seeker', 'admin', or 'ingestion')
 * @returns ValidationResult with valid flag, errors array, and parsed data if valid
 */
export function validateAgentOutput(output: unknown, contractType: ContractType): ValidationResult {
    const schema = contractType === 'admin'
        ? AdminOutputSchema
        : contractType === 'ingestion'
            ? IngestionOutputSchema
            : SeekerOutputSchema;

    const result = schema.safeParse(output);

    if (result.success) {
        return {
            valid: true,
            data: result.data as SeekerOutput | AdminOutput | IngestionOutput,
        };
    }

    const errors = result.error.issues.map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
    });

    return {
        valid: false,
        errors,
    };
}

/**
 * Check if an action is valid for a given contract type.
 */
export function isValidAction(action: string, contractType: ContractType): boolean {
    const actions = contractType === 'admin'
        ? AdminActions
        : contractType === 'ingestion'
            ? IngestionActions
            : SeekerActions;
    return (actions as readonly string[]).includes(action);
}

/**
 * Get the list of valid actions for a contract type.
 */
export function getValidActions(contractType: ContractType): readonly string[] {
    return contractType === 'admin'
        ? AdminActions
        : contractType === 'ingestion'
            ? IngestionActions
            : SeekerActions;
}
