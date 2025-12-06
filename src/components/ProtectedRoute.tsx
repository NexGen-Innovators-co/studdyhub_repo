// components/ProtectedRoute.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { verifyResourceAccess } from '../utils/varifyAccess';

interface ProtectedRouteProps {
    children: React.ReactNode;
    resourceType?: 'post' | 'group' | 'profile' | 'chat' | 'note' | 'document' | 'recording' | 'quiz';
}

export const ProtectedRoute = ({ children, resourceType }: ProtectedRouteProps) => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const params = useParams();
    const [isVerifying, setIsVerifying] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);

    useEffect(() => {
        const verifyAccess = async () => {
            if (authLoading || !user) {
                setIsVerifying(false);
                return;
            }

            try {
                let accessGranted = true;

                // Check based on resource type and params
                if (resourceType === 'post' && params.postId) {
                    accessGranted = await verifyResourceAccess.verifyPost(params.postId, user.id);
                } else if (resourceType === 'group' && params.groupId) {
                    accessGranted = await verifyResourceAccess.verifyGroup(params.groupId, user.id);
                } else if (resourceType === 'profile' && params.userId) {
                    accessGranted = await verifyResourceAccess.verifyProfile(params.userId, user.id);
                } else if (resourceType === 'chat' && params.sessionId) {
                    accessGranted = await verifyResourceAccess.verifyChatSession(params.sessionId, user.id);
                }
                // Add more resource types as needed

                setHasAccess(accessGranted);

                if (!accessGranted) {
                    // Redirect to safe route after a delay
                    setTimeout(() => {
                        navigate('/dashboard', { replace: true });
                    }, 1000);
                }
            } catch (error) {
                console.error('Access verification failed:', error);
                setHasAccess(false);
                navigate('/dashboard', { replace: true });
            } finally {
                setIsVerifying(false);
            }
        };

        verifyAccess();
    }, [user, authLoading, resourceType, params, navigate]);

    if (authLoading || isVerifying) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Verifying access...</p>
                </div>
            </div>
        );
    }

    if (!hasAccess) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-950">
                <div className="text-center">
                    <div className="text-red-500 text-4xl mb-4">⛔</div>
                    <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
                    <p className="text-gray-400">You don't have permission to access this resource.</p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};