import Link from 'next/link'

import PageHeader from '@/components/ui/PageHeader'

const coachingQuestions = [
  'Are we getting our wide players on the ball?',
  'Where are we losing possession?',
  'Are players attempting more 1v1s?',
  'Are we creating better shooting opportunities?',
  'Is a player becoming more involved over time?',
]

const firstMatchEvents = [
  'Touches',
  'Shots',
  'Successful 1v1',
  'Possession gained/lost',
]

const goodUseExamples = [
  'Comparing a player’s involvement over several matches.',
  'Seeing whether a coaching theme is improving.',
  'Identifying areas of the pitch where possession is lost.',
  'Supporting feedback to players and parents.',
]

export default function HowToUsePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:p-6">
      <Link href="/" className="text-sm font-semibold text-blue-800 hover:underline">
        Back to Home
      </Link>

      <PageHeader
        eyebrow="Quick guide"
        title="How to use Can You Coach"
        description="Use Can You Coach to support player development, reflection and practical grassroots coaching. The scoreline tells you the result. Can You Coach helps you understand the development story behind it."
        actions={(
          <Link
            href="/match-day/new"
            className="inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800"
          >
            Set up Match Day
          </Link>
        )}
      />

      <div className="grid gap-4">
        <GuideSection title="Start With A Coaching Question">
          <p>
            Match data is most useful when it starts with something you want to learn. Pick a simple coaching question before the match, then choose events that help you reflect on it afterwards.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {coachingQuestions.map((question) => (
              <p key={question} className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-950">
                {question}
              </p>
            ))}
          </div>
        </GuideSection>

        <GuideSection title="Track Less, Learn More">
          <p>
            Choose a small number of events so recording stays realistic on the touchline. If you are coaching alone, track 2-4 events. If you have an assistant, you can track more.
          </p>
          <p className="mt-3">
            Do not try to track everything. A focused picture is more useful than a busy screen that distracts you from coaching.
          </p>
        </GuideSection>

        <GuideSection title="Recommended First Match Setup">
          <p>
            For a first match, keep the setup simple and development-focused. A good starting point is:
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {firstMatchEvents.map((eventName) => (
              <span key={eventName} className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-900">
                {eventName}
              </span>
            ))}
          </div>
          <p className="mt-3">
            These are only suggestions. Coaches can choose their own events based on the players, age group and coaching theme.
          </p>
        </GuideSection>

        <GuideSection title="Use Data For Reflection">
          <p>
            Data should support coaching judgement, not replace it. Use match information after the game to shape coaching conversations, plan future sessions and give simple feedback to players and parents.
          </p>
          <p className="mt-3">
            The scoreline is not the only measure of progress. A team may lose but still improve how often players receive the ball, attempt 1v1s or create better shooting chances.
          </p>
        </GuideSection>

        <GuideSection title="Location And Heat Maps">
          <p>
            Location tracking is an optional extra. It is useful when you are answering a specific question, such as where possession is being lost or where a player is receiving the ball.
          </p>
          <p className="mt-3">
            Use it sparingly, especially if you are coaching alone. It is better to record fewer things well than to miss the match because you are looking at the screen.
          </p>
        </GuideSection>

        <GuideSection title="What Good Use Looks Like">
          <div className="grid gap-2 sm:grid-cols-2">
            {goodUseExamples.map((example) => (
              <p key={example} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800">
                {example}
              </p>
            ))}
          </div>
        </GuideSection>

        <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-950">Ready to track your next match?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Start small, choose a clear question and use the data for reflection after the game.
              </p>
            </div>
            <Link
              href="/match-day/new"
              className="inline-flex justify-center rounded-lg bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800"
            >
              Set up Match Day
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}

function GuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_14px_35px_rgba(15,23,42,0.055)] sm:p-6">
      <h2 className="text-2xl font-extrabold text-slate-950">{title}</h2>
      <div className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
        {children}
      </div>
    </section>
  )
}
