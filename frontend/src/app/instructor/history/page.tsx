'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InstructorHistoryRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/instructor/purchases');
  }, [router]);

  return (
    <div className="page-loading">
      <div className="spinner" />
    </div>
  );
}
