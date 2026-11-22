import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  HelpCircle,
  LifeBuoy,
  Lock,
  Mail,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { LogoDownloadCard } from './LogoDownloadCard';

export type LegalPageId = 'privacy' | 'terms' | 'support' | 'contact' | 'data-deletion';

export interface DeletionExecutionResult {
  deletedCloudChildren: number;
  deletedCloudDocs: number;
  clearedLocalStorage: boolean;
  disconnectedMeta: boolean;
  signedOutEmail: string | null;
}

interface DeletionStatusRecord {
  confirmationCode: string;
  source: 'meta_callback' | 'self_service' | 'email_request';
  status: 'completed' | 'received';
  identifierHint: string;
  createdAtIso: string;
  details: string;
}

interface LegalSupportPagesProps {
  page: LegalPageId;
  userEmail: string | null;
  childrenCount: number;
  onNavigatePage: (page: LegalPageId) => void;
  onBackToApp: () => void;
  onDeleteAllUserData: () => Promise<DeletionExecutionResult>;
}

const SUPPORT_EMAIL = 'cleaningserviceyeg@gmail.com';
const LAST_UPDATED_DATE = 'November 18, 2026';

const LEGAL_TABS: { id: LegalPageId; label: string; path: string }[] = [
  { id: 'privacy', label: 'Privacy Policy', path: '/privacy' },
  { id: 'terms', label: 'Terms of Service', path: '/terms' },
  { id: 'support', label: 'Support', path: '/support' },
  { id: 'contact', label: 'Contact', path: '/contact' },
  { id: 'data-deletion', label: 'Data Deletion', path: '/data-deletion' },
];

const SUPPORT_FAQS: { category: string; question: string; answer: string }[] = [
  {
    category: 'Measuring',
    question: 'How do I measure my child in feet, inches, and pounds?',
    answer:
      'SproutScale displays feet, inches, total inches, and pounds as primary units everywhere on the Growth Wall, milestone cards, PDF reports, and Kids Playroom ruler. Metric centimeters and kilograms appear quietly as secondary references.',
  },
  {
    category: 'Photo Ruler',
    question: 'How does the calibrated Fridge / Wall Photo Ruler work?',
    answer:
      'Open Photo Ruler from the top bar or mobile bottom bar, upload or snap a full-body standing photo of your child against your wall or calibrated 69-inch kitchen fridge, and let the vision guide or draggable reference ruler lines calculate height in inches.',
  },
  {
    category: 'Profiles',
    question: 'Can I track multiple children without losing their info?',
    answer:
      'Yes. Click Add Child on the Growth Wall to create separate profiles for each sibling. Each child keeps their own date of birth, measurements, saved photos, milestone events, and avatar customization.',
  },
  {
    category: 'Photos & Cloud',
    question: 'Where are my family photos and growth records stored?',
    answer:
      'When signed in with Google, your structured growth profiles, measurements, milestone dates, and photo metadata sync securely to your private Firebase Firestore records. High-resolution photo images stay on your device (IndexedDB) and optionally back up to your own Google Drive folder when you choose to sync.',
  },
  {
    category: 'Social Sharing',
    question: 'How does Facebook & Instagram sharing work?',
    answer:
      'Use Share to FB / IG to create custom milestone story or feed cards, download them for any app, or connect your Meta account via OAuth to publish directly to an authorized Facebook Page or linked Instagram Business/Creator account. SproutScale never posts without your explicit click.',
  },
  {
    category: 'Mobile App',
    question: 'How do I install SproutScale on my phone or share it with family?',
    answer:
      'Click Download App (or Share App) in the navigation bar to install SproutScale directly onto your iPhone or Android home screen as a Progressive Web App, or copy/scan the QR share link for grandparents and co-parents.',
  },
  {
    category: 'Privacy',
    question: 'How do I permanently delete my data from SproutScale?',
    answer:
      'Visit the Data Deletion page (/data-deletion) at any time to permanently erase all cloud profiles, measurements, saved local photos, and connected Meta sessions in one step, or submit a deletion request by email or Facebook User ID.',
  },
];

export const LegalSupportPages: React.FC<LegalSupportPagesProps> = ({
  page,
  userEmail,
  childrenCount,
  onNavigatePage,
  onBackToApp,
  onDeleteAllUserData,
}) => {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://sprout-scale.com';

  // Copy helper state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Contact form state
  const [contactName, setContactName] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>(userEmail ?? '');
  const [contactTopic, setContactTopic] = useState<string>('General Support');
  const [contactMessage, setContactMessage] = useState<string>('');
  const [contactSubmitting, setContactSubmitting] = useState<boolean>(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactTicket, setContactTicket] = useState<{
    ticketId: string;
    createdAtIso: string;
  } | null>(null);

  // Data deletion state
  const [confirmWipeChecked, setConfirmWipeChecked] = useState<boolean>(false);
  const [isDeletingSelf, setIsDeletingSelf] = useState<boolean>(false);
  const [selfDeleteError, setSelfDeleteError] = useState<string | null>(null);
  const [selfDeleteResult, setSelfDeleteResult] = useState<{
    summary: DeletionExecutionResult;
    confirmationCode: string;
    statusUrl: string;
  } | null>(null);

  const [manualEmail, setManualEmail] = useState<string>(userEmail ?? '');
  const [manualFbId, setManualFbId] = useState<string>('');
  const [isSubmittingManualDel, setIsSubmittingManualDel] = useState<boolean>(false);
  const [manualDelError, setManualDelError] = useState<string | null>(null);
  const [manualDelRecord, setManualDelRecord] = useState<DeletionStatusRecord | null>(null);

  const [lookupCode, setLookupCode] = useState<string>('');
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupRecord, setLookupRecord] = useState<DeletionStatusRecord | null>(null);

  useEffect(() => {
    if (userEmail) {
      setContactEmail((prev) => prev || userEmail);
      setManualEmail((prev) => prev || userEmail);
    }
  }, [userEmail]);

  // Auto-check deletion status if ?code=... is present on /data-deletion
  useEffect(() => {
    if (page !== 'data-deletion' || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code')?.trim();
    if (!codeParam) return;
    setLookupCode(codeParam);
    void handleLookupDeletionCode(codeParam);
  }, [page]);

  const handleCopyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleLookupDeletionCode = async (rawCode: string) => {
    const clean = rawCode.trim();
    if (!clean) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await fetch(
        `/api/meta/data-deletion-status/${encodeURIComponent(clean)}`,
      );
      const data = (await res.json().catch(() => ({}))) as {
        found?: boolean;
        record?: DeletionStatusRecord;
        error?: string;
      };
      if (!res.ok || !data.found || !data.record) {
        setLookupRecord(null);
        setLookupError(data.error || 'Confirmation code not found.');
      } else {
        setLookupRecord(data.record);
      }
    } catch {
      setLookupError('Could not check deletion status right now. Please try again.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSelfServiceDeletion = async () => {
    if (!confirmWipeChecked || isDeletingSelf) return;
    setSelfDeleteError(null);
    setIsDeletingSelf(true);
    try {
      const summary = await onDeleteAllUserData();
      const detailsText = summary.signedOutEmail
        ? `Deleted ${summary.deletedCloudChildren} cloud child profile(s), ${summary.deletedCloudDocs} Firestore record(s), local device photo caches, and disconnected Meta OAuth.`
        : 'Cleared all local device profiles, measurements, saved photo caches, and disconnected Meta OAuth.';

      const res = await fetch('/api/data-deletion/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'self_service',
          email: summary.signedOutEmail ?? '',
          details: detailsText,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        record?: DeletionStatusRecord;
        statusUrl?: string;
      };
      const code = json.record?.confirmationCode || `DEL-${Date.now().toString(16).toUpperCase()}`;
      const statusUrl =
        json.statusUrl || `${origin}/data-deletion?code=${encodeURIComponent(code)}`;

      setSelfDeleteResult({
        summary,
        confirmationCode: code,
        statusUrl,
      });
      setConfirmWipeChecked(false);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not complete full deletion. Please try again or contact support.';
      setSelfDeleteError(msg);
    } finally {
      setIsDeletingSelf(false);
    }
  };

  const handleManualDeletionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingManualDel) return;
    setManualDelError(null);
    setIsSubmittingManualDel(true);
    try {
      const res = await fetch('/api/data-deletion/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'email_request',
          email: manualEmail.trim(),
          facebookUserId: manualFbId.trim(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        record?: DeletionStatusRecord;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.record) {
        setManualDelError(json.error || 'Could not submit data deletion request.');
        return;
      }
      setManualDelRecord(json.record);
      setManualEmail('');
      setManualFbId('');
    } catch {
      setManualDelError('Network error while submitting request. Please email us directly.');
    } finally {
      setIsSubmittingManualDel(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contactSubmitting) return;
    setContactError(null);
    setContactSubmitting(true);
    try {
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName.trim(),
          email: contactEmail.trim(),
          topic: contactTopic,
          message: contactMessage.trim(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ticketId?: string;
        createdAtIso?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.ticketId) {
        setContactError(json.error || 'Please check your form details and try again.');
        return;
      }
      setContactTicket({
        ticketId: json.ticketId,
        createdAtIso: json.createdAtIso || new Date().toISOString(),
      });
      setContactMessage('');
    } catch {
      setContactError('Unable to submit right now. You can also email us directly below.');
    } finally {
      setContactSubmitting(false);
    }
  };

  const metaUrls: { key: string; label: string; url: string }[] = [
    { key: 'privacy', label: 'Privacy Policy URL', url: `${origin}/privacy` },
    { key: 'terms', label: 'Terms of Service URL', url: `${origin}/terms` },
    { key: 'support', label: 'Support URL', url: `${origin}/support` },
    { key: 'contact', label: 'Contact URL', url: `${origin}/contact` },
    { key: 'deletion_page', label: 'User Data Deletion Instructions URL', url: `${origin}/data-deletion` },
    { key: 'deletion_cb', label: 'Meta Data Deletion Callback URL (POST)', url: `${origin}/api/meta/data-deletion` },
  ];

  return (
    <section aria-label="Legal, Support and Privacy Center" className="max-w-4xl mx-auto space-y-6">
      {/* Shared Top Legal & Support Navigation Bar */}
      <div className="bg-white rounded-3xl border-2 border-amber-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToApp}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to SproutScale
          </button>

          <p className="text-xs font-semibold text-slate-500">
            SproutScale Trust &amp; Support Center · Last updated {LAST_UPDATED_DATE}
          </p>
        </div>

        <nav
          aria-label="Legal and support pages"
          className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-100"
        >
          {LEGAL_TABS.map((tab) => {
            const isActive = page === tab.id;
            return (
              <a
                key={tab.id}
                href={tab.path}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigatePage(tab.id);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-sky-100 hover:text-indigo-950'
                }`}
              >
                {tab.label}
              </a>
            );
          })}
        </nav>
      </div>

      {/* ============================ /privacy ============================ */}
      {page === 'privacy' && (
        <article className="bg-white rounded-3xl border-2 border-sky-200 p-6 sm:p-8 shadow-xs space-y-6 text-slate-700 leading-relaxed">
          <header className="space-y-2 border-b border-slate-100 pb-5">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-sky-800">
              <ShieldCheck className="w-4 h-4 text-sky-600" aria-hidden="true" />
              <span>Privacy Policy · Effective {LAST_UPDATED_DATE}</span>
            </div>
            <h1 className="text-3xl font-display font-extrabold text-indigo-950">
              SproutScale Privacy Policy
            </h1>
            <p className="text-sm text-slate-600">
              SproutScale is a parent-controlled family height, weight, and milestone tracker. This policy explains what information we collect, how we use Meta Pixel and optional social integrations, how we protect children’s privacy, and how you can delete your data at any time.
            </p>
          </header>

          <div className="space-y-5 text-sm">
            <section className="space-y-2">
              <h2 className="text-lg font-display font-bold text-indigo-950">
                1. Information We Collect
              </h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Parent Account Information:</strong> If you sign in with Google, we receive your name, verified email address, and Google account identifier through Firebase Authentication solely to keep your family records private to you.
                </li>
                <li>
                  <strong>Family Growth Records You Enter:</strong> Child nickname/name, optional date of birth, optional growth curve preference, height and weight check-ins, milestone stories, and photo captions.
                </li>
                <li>
                  <strong>Photos &amp; Camera Captures:</strong> Photos you capture or upload for avatars, wall/fridge height calibration, or your child’s gallery are saved locally on your device (browser IndexedDB) and, only when you explicitly request backup, uploaded to your personal Google Drive account. Photo measurements sent to the AI height estimator are processed transiently to return an inch estimate and are not sold or used to build ad profiles.
                </li>
                <li>
                  <strong>Basic Usage &amp; Advertising Measurement Data:</strong> Standard browser and page-view events via Meta Pixel (detailed in Section 3 below) to measure the effectiveness of our advertisements.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-display font-bold text-indigo-950">
                2. Children’s Privacy (Parent-Controlled Use)
              </h2>
              <p>
                SproutScale is designed for parents and legal guardians to record their children’s growth. Accounts may only be created by adults (18+). Children do not register accounts, cannot publish content publicly, and our Kids Playroom games operate locally on your device without collecting personal information from children or serving third-party behavioral ads inside the games.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-display font-bold text-indigo-950">
                3. Meta Pixel, Facebook &amp; Instagram Integrations
              </h2>
              <p>
                We use the <strong>Meta Pixel (Pixel ID: 1701764191622077)</strong> on SproutScale to measure page visits (<code>PageView</code>) and evaluate how parents discover SproutScale through Meta ads. Meta may use cookies or similar technologies in accordance with Meta’s Privacy Policy. You can manage or opt out of Meta ad personalization through your Facebook Ad Preferences or browser cookie controls.
              </p>
              <p>
                If you optionally connect Facebook or Instagram inside our Share Studio, we request only the permissions needed to list your authorized Facebook Pages / linked Instagram Business or Creator accounts and publish a milestone card when you explicitly click Publish. We never sell Facebook or Instagram data, never post without your action, and store OAuth tokens strictly in temporary server session memory that can be revoked immediately.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-display font-bold text-indigo-950">
                4. How We Use &amp; Share Data
              </h2>
              <p>
                We use your data strictly to provide and improve SproutScale features (growth wall visualization, printable PDF reports, multi-child cloud sync, Google Drive keepsake backups, and optional user-initiated social sharing). We do <strong>not</strong> sell your personal data or your family’s growth photos to data brokers or third parties.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-display font-bold text-indigo-950">
                5. Data Retention &amp; Your Right to Delete Data
              </h2>
              <p>
                You control your family records and may delete individual children, measurements, or photos at any time—or wipe your entire account and all local/cloud/Meta session data immediately using our self-service Data Deletion page.
              </p>
              <div className="pt-1 flex flex-wrap gap-3">
                <a
                  href="/data-deletion"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigatePage('data-deletion');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  Go to Data Deletion Center
                </a>
                <a
                  href="/contact"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigatePage('contact');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                >
                  <Mail className="w-4 h-4" aria-hidden="true" />
                  Contact Privacy Team ({SUPPORT_EMAIL})
                </a>
              </div>
            </section>
          </div>
        </article>
      )}

      {/* ============================ /terms ============================ */}
      {page === 'terms' && (
        <article className="bg-white rounded-3xl border-2 border-indigo-200 p-6 sm:p-8 shadow-xs space-y-6 text-slate-700 leading-relaxed">
          <header className="space-y-2 border-b border-slate-100 pb-5">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-800">
              <FileText className="w-4 h-4 text-indigo-600" aria-hidden="true" />
              <span>Terms of Service · Effective {LAST_UPDATED_DATE}</span>
            </div>
            <h1 className="text-3xl font-display font-extrabold text-indigo-950">
              SproutScale Terms of Service
            </h1>
            <p className="text-sm text-slate-600">
              By accessing or using SproutScale, you agree to these Terms of Service. Please read them carefully before creating profiles or syncing family records.
            </p>
          </header>

          <div className="space-y-5 text-sm">
            <section className="space-y-2">
              <h2 className="text-lg font-display font-bold text-indigo-950">
                1. Parent &amp; Guardian Eligibility
              </h2>
              <p>
                SproutScale is intended to be set up and managed by parents, legal guardians, or authorized adult caregivers (18 years or older). You are responsible for maintaining the security of your Google and optional Meta sign-in credentials and for supervising young children when using the Kids Playroom games.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-display font-bold text-indigo-950">
                2. Non-Medical Informational Disclaimer
              </h2>
              <p>
                Growth wall visuals, photo height estimations, growth summaries, and printable PDF reports are provided strictly for personal family keepsake and informational purposes. SproutScale is <strong>not</strong> a medical device and does not provide medical advice, diagnosis, or clinical growth assessment. Always consult a qualified pediatrician regarding your child’s physical growth or health.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-display font-bold text-indigo-950">
                3. Ownership of Your Content &amp; Photos
              </h2>
              <p>
                You retain 100% ownership of all photos, measurements, notes, and milestone stories you enter into SproutScale. You grant us only the limited technical permission required to display your records back to you, calculate photo height estimates when requested, and transmit content to Google Drive or Meta/Facebook/Instagram when you explicitly trigger those actions.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-display font-bold text-indigo-950">
                4. Acceptable Use &amp; Third-Party Services
              </h2>
              <p>
                You agree not to misuse the application, attempt unauthorized access to other users’ records, or upload unlawful content. Optional integrations with Google Sign-In, Google Drive, Facebook, and Instagram are also governed by those providers’ respective terms and policies.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-display font-bold text-indigo-950">
                5. Termination &amp; Data Deletion
              </h2>
              <p>
                You may stop using SproutScale and delete all stored data at any time through our{' '}
                <a
                  href="/data-deletion"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigatePage('data-deletion');
                  }}
                  className="font-bold text-sky-700 hover:underline"
                >
                  Data Deletion page
                </a>
                . SproutScale is provided on an “as is” and “as available” basis without warranties of uninterrupted availability. For questions about these Terms, contact us at{' '}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-bold text-sky-700 hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </section>
          </div>
        </article>
      )}

      {/* ============================ /support ============================ */}
      {page === 'support' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border-2 border-emerald-200 p-6 sm:p-8 shadow-xs space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800">
              <LifeBuoy className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              <span>Help &amp; Support Center</span>
            </div>
            <h1 className="text-3xl font-display font-extrabold text-indigo-950">
              How can we help your family?
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl">
              Find quick answers about tracking multiple children, photo height calibration, Google Drive backups, Facebook/Instagram sharing, and account data deletion.
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <a
                href="/contact"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigatePage('contact');
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
              >
                <Mail className="w-4 h-4" aria-hidden="true" />
                Message Support Team
              </a>
              <a
                href="/data-deletion"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigatePage('data-deletion');
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Delete My Data
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SUPPORT_FAQS.map((item) => (
              <div
                key={item.question}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-sky-700">
                  <HelpCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{item.category}</span>
                </div>
                <h2 className="text-base font-display font-bold text-indigo-950">
                  {item.question}
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>

          <LogoDownloadCard compact />
        </div>
      )}

      {/* ============================ /contact ============================ */}
      {page === 'contact' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white rounded-3xl border-2 border-sky-200 p-6 shadow-xs space-y-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-sky-800">
                <Mail className="w-4 h-4 text-sky-600" aria-hidden="true" />
                <span>Direct Contact</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-indigo-950">
                Contact SproutScale
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Questions about your family’s growth wall, Meta/Facebook sharing, privacy compliance, or app installation? Send us a message and we will respond within 1–2 business days.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-2">
              <p className="text-xs font-bold text-slate-500">Support &amp; Privacy Email</p>
              <p className="text-sm font-mono font-bold text-indigo-950 break-all">
                {SUPPORT_EMAIL}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=SproutScale%20Support%20Inquiry`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                  Open Email App
                </a>
                <button
                  type="button"
                  onClick={() => void handleCopyText('support_email', SUPPORT_EMAIL)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-sky-300 text-sky-900 hover:bg-sky-100 text-xs font-bold transition-colors cursor-pointer"
                >
                  {copiedKey === 'support_email' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      Copy Email
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-1.5">
              <p className="font-bold text-slate-800">Quick Links</p>
              <p>
                Need to delete your account or Meta data immediately? Visit our{' '}
                <a
                  href="/data-deletion"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigatePage('data-deletion');
                  }}
                  className="font-bold text-rose-700 hover:underline"
                >
                  Data Deletion Center
                </a>
                .
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white rounded-3xl border-2 border-amber-200 p-6 shadow-xs">
            <h2 className="text-xl font-display font-bold text-indigo-950 mb-4">
              Send a Support or Privacy Message
            </h2>

            {contactTicket ? (
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>Message Received!</span>
                </div>
                <p className="text-sm text-emerald-950">
                  Thank you for reaching out. Your reference ticket is{' '}
                  <span className="font-mono font-bold">{contactTicket.ticketId}</span>. We typically reply within 1–2 business days.
                </p>
                <button
                  type="button"
                  onClick={() => setContactTicket(null)}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => void handleContactSubmit(e)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block space-y-1">
                    <span className="text-xs font-bold text-slate-700">Your Name</span>
                    <input
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Alex Morgan"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-bold text-slate-700">Email Address</span>
                    <input
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="parent@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-bold text-slate-700">Topic</span>
                  <select
                    value={contactTopic}
                    onChange={(e) => setContactTopic(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <option value="General Support">General Support</option>
                    <option value="Privacy & Meta Ads Inquiry">Privacy &amp; Meta Ads Inquiry</option>
                    <option value="Data Deletion Request">Data Deletion Request</option>
                    <option value="Photo Ruler & Measurements">Photo Ruler &amp; Measurements</option>
                    <option value="Google Drive / Cloud Sync">Google Drive / Cloud Sync</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-bold text-slate-700">How can we help?</span>
                  <textarea
                    required
                    rows={4}
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="Share a brief description of your question or request..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </label>

                {contactError && (
                  <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl">
                    {contactError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={contactSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-950 hover:bg-indigo-900 disabled:opacity-60 text-white text-sm font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  {contactSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================ /data-deletion ============================ */}
      {page === 'data-deletion' && (
        <div className="space-y-6">
          <header className="bg-white rounded-3xl border-2 border-rose-200 p-6 sm:p-8 shadow-xs space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-rose-700">
              <Lock className="w-4 h-4 text-rose-600" aria-hidden="true" />
              <span>User Data Deletion · Meta &amp; Privacy Compliance</span>
            </div>
            <h1 className="text-3xl font-display font-extrabold text-indigo-950">
              SproutScale User Data Deletion
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
              You can permanently delete all SproutScale child profiles, growth measurements, milestone stories, local photo caches, and connected Meta (Facebook &amp; Instagram) sessions immediately below, or submit a deletion request by email or Facebook User ID.
            </p>
          </header>

          {/* Status Verification Result (used when Meta redirects to /data-deletion?code=...) */}
          {(lookupRecord || lookupError || lookupLoading) && (
            <div className="bg-white rounded-2xl border-2 border-emerald-300 p-5 shadow-xs space-y-2">
              <h2 className="text-sm font-display font-bold text-indigo-950">
                Data Deletion Status Check
              </h2>
              {lookupLoading && (
                <p className="text-sm text-slate-600">Checking confirmation code...</p>
              )}
              {lookupError && (
                <p className="text-sm font-semibold text-rose-700">{lookupError}</p>
              )}
              {lookupRecord && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2 font-bold text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span>Status: {lookupRecord.status === 'completed' ? 'Completed' : 'Received & In Progress'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{lookupRecord.confirmationCode}</span>
                  </div>
                  <p className="text-xs text-emerald-900">
                    Account / Reference: <strong>{lookupRecord.identifierHint}</strong>
                  </p>
                  <p className="text-xs text-slate-700">{lookupRecord.details}</p>
                </div>
              )}
            </div>
          )}

          {/* Option 1: Instant One-Click Self-Service Deletion */}
          <div className="bg-white rounded-3xl border-2 border-rose-200 p-6 shadow-xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-display font-bold text-indigo-950">
                  Option 1: Instant Self-Service Data Deletion
                </h2>
                <p className="text-sm text-slate-600">
                  {userEmail ? (
                    <>
                      Currently signed in as <strong>{userEmail}</strong> ({childrenCount}{' '}
                      {childrenCount === 1 ? 'child profile' : 'child profiles'} detected). This permanently deletes your Firestore child profiles, measurements, photo metadata, and milestone events, clears this device’s saved photo cache and local storage, revokes any active Meta OAuth session, and signs you out.
                    </>
                  ) : (
                    <>
                      You are currently browsing in local device mode ({childrenCount}{' '}
                      {childrenCount === 1 ? 'local profile' : 'local profiles'} on this browser). This permanently wipes all locally saved profiles, measurements, cached photos, and disconnects any active Facebook/Instagram session on this browser. To also delete cloud-synced records, sign in with Google first or use Option 2 below.
                    </>
                  )}
                </p>
              </div>
            </div>

            {selfDeleteResult ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2 text-sm">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>All Data Permanently Deleted</span>
                </div>
                <p className="text-xs text-emerald-950">
                  Confirmation Code:{' '}
                  <strong className="font-mono">{selfDeleteResult.confirmationCode}</strong>
                  {selfDeleteResult.summary.signedOutEmail && (
                    <>
                      {' '}
                      · Removed {selfDeleteResult.summary.deletedCloudChildren} cloud profile(s) and{' '}
                      {selfDeleteResult.summary.deletedCloudDocs} Firestore document(s) for{' '}
                      {selfDeleteResult.summary.signedOutEmail}.
                    </>
                  )}
                </p>
                <p className="text-xs text-slate-600">
                  Note: Any keepsake backups you previously exported to your own personal Google Drive remain safely under your sole control inside Google Drive and can be deleted there anytime.
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <label className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmWipeChecked}
                    onChange={(e) => setConfirmWipeChecked(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-rose-400 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs font-semibold text-rose-950 leading-relaxed">
                    I understand this permanently deletes my SproutScale profiles, growth measurements, milestone stories, locally cached photos, and disconnects any connected Facebook/Instagram session. This cannot be undone.
                  </span>
                </label>

                {selfDeleteError && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 px-3.5 py-2.5 rounded-xl"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{selfDeleteError}</span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!confirmWipeChecked || isDeletingSelf}
                  onClick={() => void handleSelfServiceDeletion()}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  {isDeletingSelf ? 'Deleting All Data...' : 'Permanently Delete My Data Now'}
                </button>
              </div>
            )}
          </div>

          {/* Option 2: Email / Facebook User ID Deletion Form + Status Lookup */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h2 className="text-lg font-display font-bold text-indigo-950">
                Option 2: Request Deletion by Email or Facebook ID
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Not signed in on this device? Submit your Google email or Facebook App-Scoped User ID to log a verified deletion request and receive a confirmation code immediately.
              </p>

              {manualDelRecord ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                    <span>Deletion Request Logged</span>
                  </div>
                  <p className="text-emerald-950">
                    Confirmation Code:{' '}
                    <strong className="font-mono">{manualDelRecord.confirmationCode}</strong>
                  </p>
                  <p className="text-slate-700">{manualDelRecord.details}</p>
                </div>
              ) : (
                <form onSubmit={(e) => void handleManualDeletionSubmit(e)} className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-bold text-slate-700">Account Email</span>
                    <input
                      type="email"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      placeholder="parent@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-bold text-slate-700">
                      Facebook User ID (optional)
                    </span>
                    <input
                      type="text"
                      value={manualFbId}
                      onChange={(e) => setManualFbId(e.target.value)}
                      placeholder="e.g. 102938475610293"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                  </label>
                  {manualDelError && (
                    <p role="alert" className="text-xs font-semibold text-rose-700">
                      {manualDelError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmittingManualDel}
                    className="w-full px-4 py-2.5 rounded-xl bg-indigo-950 hover:bg-indigo-900 disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
                  >
                    {isSubmittingManualDel ? 'Submitting...' : 'Submit Deletion Request'}
                  </button>
                </form>
              )}
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h2 className="text-lg font-display font-bold text-indigo-950">
                Option 3: Remove via Facebook Settings &amp; Status Lookup
              </h2>
              <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-600 leading-relaxed">
                <li>Open your Facebook Account Settings &amp; Privacy → Settings.</li>
                <li>Click <strong>Apps and Websites</strong> and locate <strong>SproutScale</strong>.</li>
                <li>Click <strong>Remove</strong> and check the option to request data deletion. Facebook will call our automated endpoint and provide you with a confirmation code.</li>
              </ol>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <p className="text-xs font-bold text-slate-700">Check a Deletion Confirmation Code</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lookupCode}
                    onChange={(e) => setLookupCode(e.target.value)}
                    placeholder="DEL-XXXXXXXXXXXX"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  <button
                    type="button"
                    onClick={() => void handleLookupDeletionCode(lookupCode)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    Check Status
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Or email{' '}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}?subject=Data%20Deletion%20Request`}
                    className="font-bold text-sky-700 hover:underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>{' '}
                  anytime.
                </p>
              </div>
            </div>
          </div>

          {/* Copyable Meta Ads & Meta App Dashboard URLs */}
          <div className="bg-sky-50/80 rounded-3xl border border-sky-200 p-6 space-y-3">
            <h2 className="text-base font-display font-bold text-indigo-950">
              Meta Ads &amp; Meta App Dashboard Compliance URLs
            </h2>
            <p className="text-xs text-slate-600">
              Copy these live URLs directly into Meta Ads Manager or your Meta for Developers App Settings (Basic → Privacy Policy URL, Terms of Service URL, and User Data Deletion):
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {metaUrls.map((item) => (
                <div
                  key={item.key}
                  className="bg-white rounded-xl border border-sky-200 px-3.5 py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-500">{item.label}</p>
                    <p className="text-xs font-mono text-indigo-950 truncate">{item.url}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyText(item.key, item.url)}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-900 text-[11px] font-bold cursor-pointer"
                  >
                    {copiedKey === item.key ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" aria-hidden="true" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Downloadable Meta App Icon (1024x1024 PNG) & Brand Logo */}
          <LogoDownloadCard compact />
        </div>
      )}
    </section>
  );
};
