import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseConfig';

export type CurrentUser = {
  id: number;
  nom: string;
  email: string;
  member_ILIA: boolean;
} | null;

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const fetchUser = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user?.email) {
        setCurrentUser(null);
        return;
      }
      const { data, error } = await supabase
        .from('users')
        .select('id, nom, email, member_ILIA')
        .eq('email', user.email)
        .maybeSingle();

      if (!error) setCurrentUser(data);
    } catch (err) {
      console.error('useCurrentUser:', err);
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => {
    fetchUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUser();
    });
    return () => subscription.unsubscribe();
  }, []);

  return { currentUser, loadingUser };
}