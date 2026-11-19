export interface MetaInstagramAccount {
  id: string;
  username: string;
  name: string;
  profilePictureUrl?: string;
}

export interface MetaFacebookPage {
  id: string;
  name: string;
  category?: string;
  instagramAccount?: MetaInstagramAccount | null;
}

export interface MetaConnectedAccount {
  userId: string;
  userName: string;
  pages: MetaFacebookPage[];
}

export interface MetaConnectionStatus {
  configured: boolean;
  connected: boolean;
  callbackUrl: string;
  account: MetaConnectedAccount | null;
}

export type MetaPublishTarget = 'facebook_photo' | 'instagram_feed' | 'instagram_story';

export interface MetaPublishResponse {
  ok: boolean;
  postId: string;
  platformLabel: string;
  permalink?: string;
}

export async function fetchMetaConnectionStatus(): Promise<MetaConnectionStatus> {
  const res = await fetch('/api/meta/status', {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Could not check Facebook & Instagram connection status.');
  }
  return (await res.json()) as MetaConnectionStatus;
}

export async function fetchMetaAuthUrl(): Promise<{ url: string; callbackUrl: string }> {
  const res = await fetch('/api/meta/auth-url', {
    method: 'GET',
    credentials: 'include',
  });
  const data = (await res.json().catch(() => ({}))) as {
    url?: string;
    callbackUrl?: string;
    error?: string;
  };
  if (!res.ok || !data.url) {
    throw new Error(
      data.error || 'Facebook & Instagram OAuth is not configured on this server yet.',
    );
  }
  return {
    url: data.url,
    callbackUrl: data.callbackUrl || '',
  };
}

export async function disconnectMetaAccount(): Promise<void> {
  await fetch('/api/meta/disconnect', {
    method: 'POST',
    credentials: 'include',
  });
}

export async function publishToMetaSocial(payload: {
  target: MetaPublishTarget;
  pageId: string;
  instagramAccountId?: string;
  imageDataUrl: string;
  caption: string;
}): Promise<MetaPublishResponse> {
  const res = await fetch('/api/meta/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<MetaPublishResponse> & {
    error?: string;
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Could not publish to Facebook / Instagram.');
  }
  return {
    ok: true,
    postId: data.postId || '',
    platformLabel: data.platformLabel || 'Social Post',
    permalink: data.permalink,
  };
}
