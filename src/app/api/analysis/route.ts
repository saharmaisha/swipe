import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { trackAppEvent } from '@/lib/services/app-events';
import { analyzeImage } from '@/lib/services/image-analysis';
import { enforceRateLimit } from '@/lib/services/rate-limit';
import type { AnalysisRequest } from '@/lib/types/analysis';
import { analysisRequestSchema } from '@/lib/utils/validators';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = analysisRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid analysis payload' }, { status: 400 });
    }

    await enforceRateLimit({
      userId: user.id,
      eventType: 'analysis_request',
      maxRequests: 50,
      windowMs: 24 * 60 * 60 * 1000,
      path: '/api/analysis',
    });

    const analysisRequest: AnalysisRequest = parsed.data;

    const analysis = await analyzeImage(analysisRequest, user.id);

    await trackAppEvent({
      userId: user.id,
      eventType: 'analysis_completed',
      path: '/api/analysis',
      metadata: {
        pinId: analysis.pin_id,
        analysisId: analysis.id,
        mode: analysis.analysis_mode,
      },
    });

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('Analysis error:', error);
    const status =
      error instanceof Error && error.message.toLowerCase().includes('rate limit') ? 429 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status }
    );
  }
}
