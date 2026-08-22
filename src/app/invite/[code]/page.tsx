'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
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
  const { data: session, status: authStatus } = useSession();
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: 'accepted' | 'declined' } | null>(null);
  const [error, setError] = useState('');

  const code = params.code as string;

  useEffect(() => {
    if (!code) return;
    fetch(`/api/invites/accept?code=${code}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setInvite(data);
        }
      })
      .catch(() => setError('Failed to load invite'))
      .finally(() => setLoading(false));
  }, [code]);

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // Error state
  if (error || !invite) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Invite Not Found</h1>
            <p className="text-sm text-gray-500 mb-6">
              {error || 'This invite link is invalid or has been removed.'}
            </p>
            <Button onClick={() => router.push('/')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Go to SplitFlow
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired
  if (invite.isExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Invite Expired</h1>
            <p className="text-sm text-gray-500 mb-6">
              This invite from {invite.inviter.name || 'someone'} has expired. Ask them to send a new one.
            </p>
            <Button onClick={() => router.push('/')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Go to SplitFlow
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already accepted/declined
  if (invite.isAccepted) {
    const wasAccepted = invite.status === 'accepted';
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            {wasAccepted ? (
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            ) : (
              <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            )}
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              {wasAccepted ? 'Already Accepted' : 'Already Responded'}
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              {wasAccepted
                ? `You already joined ${invite.group.name}.`
                : 'You already responded to this invite.'}
            </p>
            <Button onClick={() => router.push('/')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Go to SplitFlow
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Need login
  if (authStatus === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <Card className="overflow-hidden">
            <div className="bg-emerald-600 p-6 text-center">
              <span className="text-4xl">{invite.group.emoji}</span>
              <h1 className="text-xl font-bold text-white mt-2">You're Invited!</h1>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Invited by</p>
                <p className="font-semibold text-gray-900">{invite.inviter.name || 'Someone'}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 text-center">
                <h2 className="text-lg font-bold text-gray-900">{invite.group.name}</h2>
                {invite.group.description && (
                  <p className="text-sm text-gray-500 mt-1">{invite.group.description}</p>
                )}
                <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-gray-400">
                  <Users className="w-3.5 h-3.5" />
                  {invite.group.memberCount} members
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 justify-center">
                <Mail className="w-4 h-4" />
                <span>Invited to: {invite.inviteeEmail}</span>
              </div>
              <p className="text-xs text-center text-gray-400">
                Sign in with Google or GitHub to accept this invite
              </p>
              <Button
                onClick={() => router.push(`/api/auth/signin?callbackUrl=/invite/${code}`)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11"
              >
                Sign In to Accept
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="max-w-md w-full">
            <CardContent className="p-8 text-center">
              {actionResult.type === 'accepted' ? (
                <>
                  <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
                  <h1 className="text-xl font-bold text-gray-900 mb-2">Welcome to {invite.group.name}!</h1>
                  <p className="text-sm text-gray-500">You've joined the group. Redirecting...</p>
                </>
              ) : (
                <>
                  <XCircle className="w-14 h-14 text-gray-400 mx-auto mb-4" />
                  <h1 className="text-xl font-bold text-gray-900 mb-2">Invite Declined</h1>
                  <p className="text-sm text-gray-500">No problem! You can always join later.</p>
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

  // Logged in — show accept/decline
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <Card className="overflow-hidden">
          <div className="bg-emerald-600 p-6 text-center">
            <span className="text-4xl">{invite.group.emoji}</span>
            <h1 className="text-xl font-bold text-white mt-2">You're Invited!</h1>
          </div>
          <CardContent className="p-6 space-y-5">
            <div className="text-center">
              <p className="text-sm text-gray-500">Invited by</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                {invite.inviter.image && (
                  <img src={invite.inviter.image} className="w-6 h-6 rounded-full" alt="" />
                )}
                <p className="font-semibold text-gray-900">{invite.inviter.name || 'Someone'}</p>
              </div>
            </div>

            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <h2 className="text-lg font-bold text-gray-900">{invite.group.name}</h2>
              {invite.group.description && (
                <p className="text-sm text-gray-500 mt-1">{invite.group.description}</p>
              )}
              <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-gray-400">
                <Users className="w-3.5 h-3.5" />
                {invite.group.memberCount} members
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500 justify-center">
              <Mail className="w-4 h-4" />
              <span>Invited to: {invite.inviteeEmail}</span>
            </div>

            {error && (
              <p className="text-sm text-red-500 text-center bg-red-50 rounded-lg p-2">{error}</p>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => handleAction('decline')}
                disabled={actionLoading}
              >
                Decline
              </Button>
              <Button
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleAction('accept')}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>
                    Accept
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
