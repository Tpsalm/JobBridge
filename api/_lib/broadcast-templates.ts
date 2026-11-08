/**
 * JobBridge — broadcast template catalogue + web-push payload builder.
 *
 * Single source of truth for:
 *  - `api/_lib/admin-broadcast-handler.ts` (serves the catalogue to the admin console)
 *  - `api/_lib/process-broadcasts-handler.ts` (renders per-recipient inbox + push payloads)
 *
 * Templates are server owned so every admin console renders the same validated
 * catalogue and every phone receives the same structured notification payload.
 *
 * Supported placeholders inside titles/bodies: {{first_name}}, {{name}}, {{app_name}}, {{site_url}}.
 */

export type BroadcastChannel = 'in_app' | 'push' | 'sms';

export type BroadcastTypeMeta = {
  id: string;
  label: string;
  emoji: string;
  accent: string;
  tagPrefix: string;
  requireInteraction: boolean;
  urgency: 'very-low' | 'low' | 'normal' | 'high';
};

export type BroadcastTemplate = {
  id: string;
  name: string;
  summary: string;
  type: string;
  title: string;
  content: string;
  actionUrl: string;
  actionLabel: string;
  channels: BroadcastChannel[];
};

export const APP_NAME = 'JobBridge';
export const PUSH_ICON = 'images/jobbridge-logo.jpeg';
export const MAX_TITLE = 120;
export const MAX_CONTENT = 4000;
export const DEFAULT_BROADCAST_TYPE = 'announcement';

const TEST_TYPE_META: BroadcastTypeMeta = {
  id: 'test',
  label: 'Test campaign',
  emoji: '🧪',
  accent: '#f59e0b',
  tagPrefix: 'test',
  requireInteraction: false,
  urgency: 'normal',
};

export const BROADCAST_TYPES: BroadcastTypeMeta[] = [
  { id: 'announcement', label: 'Announcement', emoji: '📣', accent: '#2563eb', tagPrefix: 'announcement', requireInteraction: false, urgency: 'normal' },
  { id: 'job_alert', label: 'Job alert', emoji: '💼', accent: '#0ea5e9', tagPrefix: 'job-alert', requireInteraction: false, urgency: 'normal' },
  { id: 'promo', label: 'Offer / promo', emoji: '🎁', accent: '#f97316', tagPrefix: 'promo', requireInteraction: false, urgency: 'normal' },
  { id: 'feature', label: 'New feature', emoji: '✨', accent: '#8b5cf6', tagPrefix: 'feature', requireInteraction: false, urgency: 'normal' },
  { id: 'maintenance', label: 'Maintenance', emoji: '🛠️', accent: '#475569', tagPrefix: 'maintenance', requireInteraction: true, urgency: 'high' },
  { id: 'security', label: 'Security', emoji: '🔐', accent: '#dc2626', tagPrefix: 'security', requireInteraction: true, urgency: 'high' },
  { id: 'payment', label: 'Billing', emoji: '💳', accent: '#059669', tagPrefix: 'billing', requireInteraction: false, urgency: 'normal' },
  { id: 'welcome', label: 'Welcome', emoji: '👋', accent: '#10b981', tagPrefix: 'welcome', requireInteraction: false, urgency: 'low' },
  { id: 'reengagement', label: 'Come back', emoji: '🔔', accent: '#6366f1', tagPrefix: 'comeback', requireInteraction: false, urgency: 'low' },
  { id: 'event', label: 'Event', emoji: '📅', accent: '#0891b2', tagPrefix: 'event', requireInteraction: false, urgency: 'normal' },
  { id: 'survey', label: 'Feedback', emoji: '📝', accent: '#a855f7', tagPrefix: 'survey', requireInteraction: false, urgency: 'low' },
  { id: 'reminder', label: 'Reminder', emoji: '⏰', accent: '#ca8a04', tagPrefix: 'reminder', requireInteraction: false, urgency: 'normal' },
];

const TYPE_BY_ID = new Map(BROADCAST_TYPES.map((type) => [type.id, type]));

export function normalizeBroadcastType(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_BROADCAST_TYPE;
  const id = value.trim().toLowerCase().replace(/[^a-z_]/g, '');
  if (!id) return DEFAULT_BROADCAST_TYPE;
  if (id === TEST_TYPE_META.id) return TEST_TYPE_META.id;
  return TYPE_BY_ID.has(id) ? id : DEFAULT_BROADCAST_TYPE;
}

export function broadcastTypeMeta(value: unknown): BroadcastTypeMeta {
  const id = normalizeBroadcastType(value);
  if (id === TEST_TYPE_META.id) return TEST_TYPE_META;
  return TYPE_BY_ID.get(id) ?? TYPE_BY_ID.get(DEFAULT_BROADCAST_TYPE)!;
}

export function safeActionUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim().slice(0, 300);
  if (!url) return null;
  if (!url.startsWith('/') || url.startsWith('//') || /[\\\r\n]/.test(url)) return null;
  return url;
}

function safeFirstName(value: unknown): string {
  if (typeof value !== 'string') return 'there';
  const cleaned = value.replace(/\s+/g, ' ').replace(/[<>{}\\]/g, '').trim();
  return cleaned ? cleaned.slice(0, 40) : 'there';
}

/** Renders `{{first_name}}` style placeholders without ever leaking raw tokens. */
export function renderMessage(text: unknown, firstName?: unknown): string {
  const source = typeof text === 'string' ? text : '';
  const name = safeFirstName(firstName);
  return source
    .replace(/\{\{\s*first_name\s*\}\}/gi, name)
    .replace(/\{\{\s*name\s*\}\}/gi, name)
    .replace(/\{\{\s*app_name\s*\}\}/gi, APP_NAME)
    .replace(/\{\{\s*site_url\s*\}\}/gi, 'jobbridge.com.ng')
    .slice(0, MAX_CONTENT);
}

const DUAL: BroadcastChannel[] = ['in_app', 'push'];

export const BROADCAST_TEMPLATES: BroadcastTemplate[] = [
  {
    id: 'announcement-product-update',
    name: 'Product update',
    summary: 'Tell every user what just improved on JobBridge.',
    type: 'feature',
    title: '✨ {{app_name}} just got better',
    content: 'Hi {{first_name}}, we shipped improvements that make applying for jobs faster. Open JobBridge to see what changed.',
    actionUrl: '/jobs',
    actionLabel: 'See what is new',
    channels: DUAL,
  },
  {
    id: 'announcement-general',
    name: 'General announcement',
    summary: 'A neutral notice for the whole community.',
    type: 'announcement',
    title: '📣 Important update from {{app_name}}',
    content: 'Hi {{first_name}}, we have an important update for you. Tap to read the details inside the app.',
    actionUrl: '/notifications',
    actionLabel: 'Read update',
    channels: DUAL,
  },
  {
    id: 'job-alert-fresh-roles',
    name: 'Fresh jobs alert',
    summary: 'Drive job seekers back to new listings.',
    type: 'job_alert',
    title: '💼 New jobs match your profile',
    content: 'Hi {{first_name}}, fresh roles were posted today in your field. Apply early - the best ones close fast.',
    actionUrl: '/jobs',
    actionLabel: 'Browse jobs',
    channels: DUAL,
  },
  {
    id: 'job-alert-recruiter-talent',
    name: 'Talent pool alert',
    summary: 'Re-engage recruiters with matching candidates.',
    type: 'job_alert',
    title: '🧑‍💼 New verified talent is waiting',
    content: 'Hi {{first_name}}, verified candidates just joined {{app_name}}. Post a role or search the talent pool to reach them first.',
    actionUrl: '/talent-search',
    actionLabel: 'Find talent',
    channels: DUAL,
  },
  {
    id: 'promo-subscription-offer',
    name: 'Subscription offer',
    summary: 'Promote plans or a discount window.',
    type: 'promo',
    title: '🎁 A limited offer on {{app_name}}',
    content: 'Hi {{first_name}}, unlock unlimited job posts, priority visibility and AI tools. See the plans available today.',
    actionUrl: '/pricing',
    actionLabel: 'See plans',
    channels: DUAL,
  },
  {
    id: 'promo-free-trial',
    name: 'Free trial nudge',
    summary: 'Invite users to start the free trial.',
    type: 'promo',
    title: '🚀 Your free trial is waiting',
    content: 'Hi {{first_name}}, try every premium {{app_name}} tool free. No charge until the trial ends - cancel anytime.',
    actionUrl: '/pricing',
    actionLabel: 'Start trial',
    channels: DUAL,
  },
  {
    id: 'maintenance-window',
    name: 'Maintenance window',
    summary: 'Warn users about planned downtime.',
    type: 'maintenance',
    title: '🛠️ Scheduled maintenance tonight',
    content: 'Hi {{first_name}}, {{app_name}} will be briefly unavailable tonight while we upgrade the platform. Your data is safe - we will be back shortly.',
    actionUrl: '/notifications',
    actionLabel: 'Details',
    channels: DUAL,
  },
  {
    id: 'security-account-safety',
    name: 'Account safety',
    summary: 'Security reminder or suspicious activity notice.',
    type: 'security',
    title: '🔐 Keep your account safe',
    content: 'Hi {{first_name}}, never share your {{app_name}} password or one-time code with anyone. Review your active sessions if you notice anything unusual.',
    actionUrl: '/profile',
    actionLabel: 'Review account',
    channels: DUAL,
  },
  {
    id: 'payment-renewal-reminder',
    name: 'Renewal reminder',
    summary: 'Remind users a subscription payment is due.',
    type: 'payment',
    title: '💳 Your plan renews soon',
    content: 'Hi {{first_name}}, your {{app_name}} subscription renews soon. Confirm your card details so your listings stay visible without interruption.',
    actionUrl: '/manage-subscription',
    actionLabel: 'Manage plan',
    channels: DUAL,
  },
  {
    id: 'welcome-new-member',
    name: 'Welcome new member',
    summary: 'Onboard users who just joined.',
    type: 'welcome',
    title: '👋 Welcome to {{app_name}}',
    content: 'Hi {{first_name}}, welcome aboard! Complete your profile, upload your CV and start applying to verified roles today.',
    actionUrl: '/profile',
    actionLabel: 'Complete profile',
    channels: DUAL,
  },
  {
    id: 'reengagement-return',
    name: 'We miss you',
    summary: 'Win back inactive users.',
    type: 'reengagement',
    title: '🔔 New opportunities are waiting',
    content: 'Hi {{first_name}}, it has been a while. New jobs and providers were added since your last visit - take a look.',
    actionUrl: '/jobs',
    actionLabel: 'Open JobBridge',
    channels: DUAL,
  },
  {
    id: 'event-webinar',
    name: 'Event / webinar',
    summary: 'Invite users to a live session.',
    type: 'event',
    title: '📅 You are invited: career session',
    content: 'Hi {{first_name}}, join our next {{app_name}} career session. Reserve your spot inside the app before seats fill up.',
    actionUrl: '/career',
    actionLabel: 'Reserve seat',
    channels: DUAL,
  },
  {
    id: 'survey-feedback',
    name: 'Feedback request',
    summary: 'Ask users what to improve next.',
    type: 'survey',
    title: '📝 Tell us how we did',
    content: 'Hi {{first_name}}, your feedback shapes {{app_name}}. Take one minute to tell us what is working and what should change.',
    actionUrl: '/support',
    actionLabel: 'Give feedback',
    channels: DUAL,
  },
  {
    id: 'reminder-verification',
    name: 'Verification reminder',
    summary: 'Nudge users to verify their profile or phone.',
    type: 'reminder',
    title: '⏰ One step left to get verified',
    content: 'Hi {{first_name}}, verified accounts get seen faster. Finish your verification to unlock full access on {{app_name}}.',
    actionUrl: '/profile',
    actionLabel: 'Finish setup',
    channels: DUAL,
  },
  {
    id: 'provider-verification',
    name: 'Provider verification',
    summary: 'Service providers: complete verification.',
    type: 'reminder',
    title: '✅ Get your service business verified',
    content: 'Hi {{first_name}}, verified providers win more client requests. Upload your documents to finish verification on {{app_name}}.',
    actionUrl: '/providers',
    actionLabel: 'Verify business',
    channels: DUAL,
  },
];

export type PushCampaignInput = {
  id: string;
  title: string;
  content: string;
  action_url?: string | null;
  action_label?: string | null;
  broadcast_type?: string | null;
};

export type PushPayload = {
  title: string;
  body: string;
  icon: string;
  badge: string;
  tag: string;
  renotify: boolean;
  requireInteraction: boolean;
  vibrate: number[];
  timestamp: number;
  actions: Array<{ action: string; title: string }>;
  data: {
    url: string;
    campaignId: string;
    broadcastType: string;
    emoji: string;
    accent: string;
    actionLabel: string | null;
  };
};

/** Builds the exact payload the service worker renders on the user's phone. */
export function buildPushPayload(campaign: PushCampaignInput, firstName?: unknown): PushPayload {
  const meta = broadcastTypeMeta(campaign.broadcast_type);
  const body = renderMessage(campaign.content, firstName);
  const relativeTitle = renderMessage(campaign.title, firstName);
  const hasEmoji = /^\p{Extended_Pictographic}/u.test(relativeTitle);
  const title = `${hasEmoji ? '' : `${meta.emoji} `}${relativeTitle}`.trim().slice(0, MAX_TITLE + 4);
  return {
    title,
    body,
    icon: PUSH_ICON,
    badge: PUSH_ICON,
    tag: `jobbridge-${meta.tagPrefix}-${campaign.id}`,
    renotify: meta.urgency === 'high',
    requireInteraction: meta.requireInteraction,
    vibrate: meta.urgency === 'high' ? [180, 90, 180] : [120],
    timestamp: Date.now(),
    actions: [{ action: 'open', title: (campaign.action_label || '').trim().slice(0, 30) || 'Open' }],
    data: {
      url: safeActionUrl(campaign.action_url) || '/notifications',
      campaignId: campaign.id,
      broadcastType: meta.id,
      emoji: meta.emoji,
      accent: meta.accent,
      actionLabel: campaign.action_label ? campaign.action_label.trim().slice(0, 50) : null,
    },
  };
}

/** Web-push transport options (TTL, urgency, hard timeout) for a campaign. */
export function buildPushOptions(campaign: PushCampaignInput) {
  const meta = broadcastTypeMeta(campaign.broadcast_type);
  return { TTL: 60 * 60 * 24, urgency: meta.urgency, timeout: 6000 };
}

/** In-app inbox (`notifications`) row for one recipient. */
export function buildInboxNotification(
  campaign: PushCampaignInput,
  deliveryId: string,
  userId: string,
  firstName?: unknown,
) {
  const meta = broadcastTypeMeta(campaign.broadcast_type);
  return {
    user_id: userId,
    type: 'system',
    title: renderMessage(campaign.title, firstName).slice(0, MAX_TITLE),
    content: renderMessage(campaign.content, firstName),
    is_read: false,
    data: {
      source: 'admin_broadcast',
      campaign_id: campaign.id,
      broadcast_type: meta.id,
      emoji: meta.emoji,
      accent: meta.accent,
      action_url: safeActionUrl(campaign.action_url),
      action_label: campaign.action_label ? campaign.action_label.trim().slice(0, 50) : null,
    },
    broadcast_delivery_id: deliveryId,
  };
}
