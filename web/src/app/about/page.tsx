import type { Metadata } from "next";

export const metadata: Metadata = { title: "About and methods" };

const STAGES: [string, string][] = [
  ["Search", "An agent searches the web and fixed academic databases (OpenAlex, Europe PMC, ERIC, World Bank, the AEA RCT Registry), one task per country, language and source type. Every candidate is kept."],
  ["Download", "Each candidate's page or PDF is copied into a source library, with its text extracted, so that what was read can always be inspected later."],
  ["Screen", "GPT-6 Luna reads each source once and decides whether it is about AI for social good in the domain, writing a short card."],
  ["Organise and select", "GPT-6 Sol groups the screened sources into deployments (projects) and tools, marks duplicates, and with a budget selects those most worth analysing."],
  ["Extract", "GPT-6 Sol reads each selected source in full and fills the experts' template: what, where, who, cost, reach, outcomes, evidence. Every quote is then looked up word for word in the text by code, not by the model."],
  ["Summarise", "The sources of each project are merged into one record. Numbers are combined by code; only the narrative summary is written by the model."],
  ["Review", "Experts open each source, check its quotes against the stored copy, and pass or fail it with a comment."],
];

export default function About() {
  return (
    <article className="max-w-[860px] flex flex-col gap-5">
      <div><h1 className="page-title">About and methods</h1><p className="sub mt-1">This site collects evidence on AI deployments for social good in South and Southeast Asia, starting with Bangladesh, India, Indonesia and Thailand, in healthcare, public services, agriculture and education.</p></div>
      <section><h2 className="text-[18px] font-semibold mb-2">How a source gets here</h2><ol className="flex flex-col gap-2">{STAGES.map(([t, d], i) => <li key={t} className="card p-3.5"><b>{i + 1}. {t}.</b> <span className="text-ink-2">{d}</span></li>)}</ol></section>
      <section><h2 className="text-[18px] font-semibold mb-2">How to read the figures</h2>
        <ul className="plain text-ink-2">
          <li><b>A project is one deployment</b> of a tool in a place and phase. The same tool deployed twice is two projects.</li>
          <li><b>Relevance score</b> (0–100) is computed by rules from the extracted fields and verified quotes; it says how complete and checkable a record is, not how good the project is.</li>
          <li><b>Strength of evidence</b> runs from anecdotal to randomised trials, for the best source of each project.</li>
          <li><b>Map positions are approximate.</b> Coordinates are given by the model; a place named only at country level sits at the country's centre.</li>
          <li><b>Reach is not comparable across projects.</b> Sources count farmers, students, users or schools. Circle sizes on the map use only figures that count people; other deployments get the smallest dot.</li>
          <li><b>“Claim”</b> marks a figure that comes only from a developer or government announcement.</li>
          <li>Results shown as <b>awaiting review</b> have not yet been checked by an expert.</li>
        </ul>
      </section>
      <section><h2 className="text-[18px] font-semibold mb-2">Who can do what</h2>
        <ul className="plain text-ink-2">
          <li><b>Visitors</b> can browse the dashboard, map, and everything analysed.</li>
          <li><b>Experts</b> can also see sources not analysed yet and the stored copies, pass or fail each result with a comment, send sources to the analysis, and correct how sources are grouped into projects.</li>
          <li><b>Administrators</b> start runs, manage users and see the log of every change.</li>
        </ul>
      </section>
    </article>
  );
}
