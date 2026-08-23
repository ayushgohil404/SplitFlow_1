'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Users,
  Mail,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface InviteData {
  id: string;
  code: string;
  status: string;
  isExpired: boolean;
  isAccepted: boolean;
  group: {
    id: string;
    name: string;
    emoji: string;
    description: string | null;
    memberCount: number;
  };
  inviter: {
    name: string | null;
    image: string | null;
  };
  inviteeEmail: string;
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: 'accepted' | 'declined' } | null>(null);
  const [error, setError] = useState('');
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [isGroupCode, setIsGroupCode] = useState(false);

  const code = params.code as string;

  // Check auth using the same pattern as the rest of the app
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/session');
        const session = await res.json();
        setAuthed(!!session?.user);
      } catch {
        setAuthed(false);
      }
    })();
  }, []);

  // Fetch invite/group data — supports both Invite.code and Group.inviteCode
  useEffect(() => {
    if (!code) return;

    (async () => {
      try {
        const res = await fetch(`/api/invites/accept?code=${encodeURIComponent(code)}`);
        const data = await res.json();

        if (data.id) {
          setInvite(data);
        } else {
          const groupRes = await fetch(`/api/groups/lookup?code=${encodeURIComponent(code)}`);
          if (groupRes.ok) {
            const groupData = await groupRes.json();
            if (groupData.group) {
              setIsGroupCode(true);
              setInvite({
                id: '',
                code,
                status: 'pending',
                isExpired: false,
                isAccepted: false,
                group: groupData.group,
                inviter: { name: groupData.group.creatorName || 'Someone', image: null },
                inviteeEmail: '',
              });
            } else {
              setError('Invite not found');
            }
          } else {
            setError(data.error || 'This invite link is invalid or has been removed.');
          }
        }
      } catch {
        setError('Failed to load invite');
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  const handleJoin = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: code }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setActionResult({ type: 'accepted' });
        setTimeout(() => router.push('/'), 1500);
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = async (action: 'accept' | 'decline') => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, action }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setActionResult({ type: action === 'accept' ? 'accepted' : 'declined' });
        if (action === 'accept' && data.group) {
          setTimeout(() => router.push('/'), 1500);
        }
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setActionLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error || !invite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">Invite Not Found</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {error || 'This invite link is invalid or has been removed.'}
            </p>
            <Button onClick={() => router.push('/')} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Go to SplitFlow
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired (Invite table only)
  if (invite.isExpired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">Invite Expired</h1>
            <p className="text-sm text-muted-foreground mb-6">
              This invite from {invite.inviter.name || 'someone'} has expired. Ask them to send a new one.
            </p>
            <Button onClick={() => router.push('/')} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Go to SplitFlow
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already accepted/declined (Invite table only)
  if (invite.isAccepted) {
    const wasAccepted = invite.status === 'accepted';
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            {wasAccepted ? (
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
            ) : (
              <XCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            )}
            <h1 className="text-xl font-bold text-foreground mb-2">
              {wasAccepted ? 'Already Accepted' : 'Already Responded'}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {wasAccepted
                ? `You already joined ${invite.group.name}.`
                : 'You already responded to this invite.'}
            </p>
            <Button onClick={() => router.push('/')} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Go to SplitFlow
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Need login
  if (authed === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <Card className="overflow-hidden">
            <div className="bg-primary p-6 text-center">
              <span className="text-4xl">{invite.group.emoji}</span>
              <h1 className="text-xl font-bold text-primary-foreground mt-2">You're Invited!</h1>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Invited by</p>
                <p className="font-semibold text-foreground">{invite.inviter.name || 'Someone'}</p>
              </div>
              <div className="bg-primary/10 rounded-xl p-4 text-center">
                <h2 className="text-lg font-bold text-foreground">{invite.group.name}</h2>
                {invite.group.description && (
                  <p className="text-sm text-muted-foreground mt-1">{invite.group.description}</p>
                )}
                <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  {invite.group.memberCount} members
                </div>
              </div>
              {!isGroupCode && invite.inviteeEmail && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                  <Mail className="w-4 h-4" />
                  <span>Invited to: {invite.inviteeEmail}</span>
                </div>
              )}
              <p className="text-xs text-center text-muted-foreground">
                Sign in with Google or GitHub to {isGroupCode ? 'join this group' : 'accept this invite'}
              </p>
              <Button
                onClick={() => router.push(`/api/auth/signin?callbackUrl=/invite/${code}`)}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11"
              >
                Sign In to {isGroupCode ? 'Join' : 'Accept'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Action result
  if (actionResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="max-w-md w-full">
            <CardContent className="p-8 text-center">
              {actionResult.type === 'accepted' ? (
                <>
                  <CheckCircle2 className="w-14 h-14 text-primary mx-auto mb-4" />
                  <h1 className="text-xl font-bold text-foreground mb-2">Welcome to {invite.group.name}!</h1>
                  <p className="text-sm text-muted-foreground">You've joined the group. Redirecting...</p>
                </>
              ) : (
                <>
                  <XCircle className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
                  <h1 className="text-xl font-bold text-foreground mb-2">Invite Declined</h1>
                  <p className="text-sm text-muted-foreground">No problem! You can always join later.</p>
                  <Button onClick={() => router.push('/')} variant="outline" className="mt-4">
                    Go to SplitFlow
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <Card className="overflow-hidden">
          <div className="bg-primary p-6 text-center">
            <span className="text-4xl">{invite.group.emoji}</span>
            <h1 className="text-xl font-bold text-primary-foreground mt-2">
              {isGroupCode ? 'Join Group' : "You're Invited!"}
            </h1>
          </div>
          <CardContent className="p-6 space-y-5">
            {!isGroupCode && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Invited by</p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  {invite.inviter.image && (
                    <img src={invite.inviter.image} className="w-6 h-6 rounded-full" alt="" />
                  )}
                  <p className="font-semibold text-foreground">{invite.inviter.name || 'Someone'}</p>
                </div>
              </div>
            )}

            <div className="bg-primary/10 rounded-xl p-4 text-center">
              <h2 className="text-lg font-bold text-foreground">{invite.group.name}</h2>
              {invite.group.description && (
                <p className="text-sm text-muted-foreground mt-1">{invite.group.description}</p>
              )}
              <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                {invite.group.memberCount} members
              </div>
            </div>

            {!isGroupCode && invite.inviteeEmail && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                <Mail className="w-4 h-4" />
                <span>Invited to: {invite.inviteeEmail}</span>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive text-center bg-destructive/10 rounded-lg p-2">{error}</p>
            )}

            <div className="flex gap-3">
              {!isGroupCode && (
                <Button
                  variant="outline"
                  className="flex-1 h-11"
                  onClick={() => handleAction('decline')}
                  disabled={actionLoading}
                >
                  Decline
                </Button>
              )}
              <Button
                className={isGroupCode ? 'w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground' : 'flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground'}
                onClick={isGroupCode ? handleJoin : () => handleAction('accept')}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>
                    {isGroupCode ? 'Join Group' : 'Accept'}
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
