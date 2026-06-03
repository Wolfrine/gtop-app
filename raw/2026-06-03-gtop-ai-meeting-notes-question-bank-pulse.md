# Raw Note - 2026-06-03 - GTOP AI Meeting Notes, Question Bank, and Student Pulse

## Source

Hindi voice/transcript discussion converted into structured meeting notes.

This is a raw capture. It should later be curated into the GTOP wiki pages such as `wiki/Intent.md`, `wiki/Problems.md`, `wiki/Features.md`, `wiki/Decisions.md`, and `wiki/OpenQuestions.md`.

## 1. Context

Discussion was around GTOP product direction, especially using AI to convert recorded discussions into transcripts, extract MOM, and then feed structured points to a CEO / Codex agent for product development.

The discussion then moved into question bank verification, long-term data improvement, AI-driven student analytics, future-ready education features, and personalized student pulse reports.

## 2. Key Discussion Points

### A. Recording -> Transcript -> MOM workflow

- Hindi discussion can be recorded.
- Transcript can be generated in text format.
- ChatGPT can then extract:
  - What was discussed
  - Key points
  - Variations / options
  - Decisions
  - Action items
- ChatGPT may not perfectly distinguish different speakers, but overall discussion capture is still useful.
- Output can be given to the CEO / Codex agent to develop GTOP-related features.

### B. Existing question bank verification

- Current snapshot of GTOP / question bank should be taken.
- Existing ~1,20,000 question data needs verification.
- This is a major activity.
- Along with verification, it should identify:
  - Which boards / standards / subjects already have data
  - Where data is missing
  - How much new data needs to be added
- A ledger / tracker should be maintained.

### C. Question bank improvement should not be one-time

- This should not be treated as a one-time activity.
- It should become a daily ritual / daily process.
- Two activity patterns:
  1. Add new questions/data
  2. Improve existing questions/data
- AI/Codex can decide what needs to be checked and improved because it has access to the dataset.

### D. Product-level thinking beyond question bank

- Improving the question bank alone improves only one part of the product.
- As a product, many more features are needed.
- Need to think beyond: "we built a feature, now market it."
- Instead, reverse-think from:
  - What users already get today
  - What AI is making available
  - What education patterns may look like in the next 10 years
  - What future-ready offering GTOP can provide

### E. Future trend analysis

- Need a future trend analysis for education.
- Product should be designed as a future-ready system.
- Since ChatGPT Pro / AI tokens are already being paid for, available AI intelligence should be used for:
  - Product thinking
  - Student analytics
  - Feature ideation
  - Data enrichment
  - Personalized learning support

### F. Student-specific Pulse concept

Inspired by ChatGPT Pulse:

- ChatGPT Pulse gives an overview of recent interactions, user vision, and suggested next work.
- Similar concept can be created for every student.
- Student Pulse can include:
  - Last 1 month activity
  - Weak areas
  - Strong areas
  - Suggested daily target
  - Personalized learning recommendations
  - Visual summary / image-card format
- It should be glance-friendly and visually engaging.
- A daily scheduler can gather student activity data and generate personalized output.
- Full image generation for every student may be costly/time-consuming, so start with:
  - Limited images
  - Lightweight templates
  - Text-first personalized pulse
  - Possibly 1-2 images for initial version

### G. Current usage concern

- Current student usage is low.
- In May, only a few users came on scattered dates.
- Feature usefulness depends on students actually using the platform.
- Need to encourage students to use it consistently.
- Example: a student preparing for NEET should use it heavily, at least for Biology.

### H. Question type, pattern, and topic tagging

Need to enrich question bank with additional metadata:

- Question type / pattern tagging:
  - Example: Assertion-Reason
  - Other question patterns should be grouped
- AI can classify existing questions by type/pattern.
- Multiple tags should be supported.
- Existing chapter tagging is already present.
- Need deeper topic-level tagging inside chapters.
- Topic tagging will help identify:
  - Topic-wise strengths
  - Topic-wise weaknesses
  - Student-specific learning gaps

### I. Personalized weakness explanation

- Students are already working hard.
- They need help understanding:
  - Where they are strong
  - Where they are weak
  - How to improve weak topics
- AI can explain weak topics in easier ways.
- Same topic should be explained through multiple styles:
  - Graphical explanation
  - Practical examples
  - Different teaching approaches
  - Simplified explanation
  - Multiple examples
- This can become a unique GTOP feature.

## 3. Decisions Made

| Decision | Notes |
|---|---|
| Start with current GTOP/question bank snapshot | First verify current state before improvement |
| Verify existing ~1.2 lakh question data | Major initial activity |
| Maintain a ledger/tracker | Track verification, missing data, added data, improvements |
| Treat question bank improvement as ongoing daily process | Not one-time cleanup |
| Add metadata enrichment | Question type, pattern, tags, topic-level mapping |
| Explore student-specific Pulse feature | Daily AI-generated learning summary/recommendation |
| Use AI/Codex/CEO agent for structured product development | MOM points can be fed forward for execution |

## 4. Open Questions

- Which boards/classes/subjects already have enough verified data?
- How much new data needs to be added?
- What should be the exact data verification criteria?
- What should be the ledger format?
- What metadata fields should be added to question bank?
- How should topic tagging be structured?
- How frequently should Student Pulse run?
- Should Pulse be text-only first or include generated images/cards?
- How to increase student usage before advanced analytics becomes meaningful?
- What are the next 10-year education trends GTOP should prepare for?
- How should GTOP differentiate against AI-native education tools?

## 5. Action Items

| Action Item | Owner | Deadline | Priority | Notes |
|---|---:|---:|---|---|
| Take current GTOP/question bank snapshot | CEO / Codex agent | Not mentioned | High | Baseline before verification |
| Verify existing ~1.2 lakh question data | CEO / Codex agent | Not mentioned | High | Major data quality activity |
| Identify board/class/subject coverage | CEO / Codex agent | Not mentioned | High | Find what exists and what is missing |
| Create/maintain verification ledger | CEO / Codex agent | Not mentioned | High | Track verification and additions |
| Convert verification into daily process | CEO / Codex agent | Not mentioned | High | Long-term data improvement pipeline |
| Add question type/pattern classification | CEO / Codex agent / LLM | Not mentioned | High | Assertion-reason etc. |
| Add topic-level tagging | CEO / Codex agent / LLM | Not mentioned | High | Needed for weak/strong topic analysis |
| Review existing DB/data structure | LLM / Codex agent | Not mentioned | High | Suggest how to add these fields cleanly |
| Design Student Pulse feature | Product/CEO agent | Not mentioned | Medium-High | Daily student-specific recommendations |
| Check feasibility of Pulse implementation | Dev / Codex agent | Not mentioned | Medium | Initial estimate mentioned: simple version could be 1 day |
| Encourage test students to use product | Sachit / GT team | Not mentioned | Medium | Especially NEET Biology example |
| Run future education trend analysis | LLM / Product agent | Not mentioned | Medium-High | Needed for future-ready GTOP system |

## 6. Disagreements or Unresolved Views

- No direct disagreement captured.
- Unresolved points:
  - Whether to prioritize question bank cleanup first or student-facing AI features first.
  - Whether Student Pulse should be implemented now despite low platform usage.
  - Whether image-based Pulse is worth the processing time/cost initially.
  - Exact structure for question pattern/topic tagging is not finalized.
  - Product direction needs deeper future-trend analysis before final roadmap.

## 7. Important Quotes / Phrases

> "ChatGPT उतना efficient नहीं है कि वो distinguish कर पाए कि कौन से अलग-अलग users बात कर रहे हैं, but at least overall discussion record हो जाएगा."

> "Existing अपना 1,20,000 का जो भी data है उसका verify करवाना है."

> "इसको one-time activity नहीं, daily ritual जैसा या daily process जैसा set करना पड़ेगा."

> "नए भी add करने हैं और existing को improvise करना है — ये दो pattern में activity करनी है."

> "As a product हमें बहुत सारी चीज़ें चाहिए."

> "Users को as of now क्या already available हो रहा है with AI growing so far..."

> "Next 10 years में क्या चीज़ें होंगी और लोगों का pattern education के related कैसे होने वाला है..."

> "Student specific Pulse."

> "Last one month में क्या activity हुई, कहाँ weak हैं, कहाँ strong हैं, daily target रखो."

> "Question pattern कौन सा है उसका grouping करवा लें AI के through."

> "Chapter तो already tag है, but topic कौन सा है — topic tagging हो जाए."

> "Student को help चाहिए कि कोई देख पाए कि मैं इधर strong हूँ, इधर weak हूँ."

> "Weak है तो उसको different तरीके से सिखाएं, not just one way."

## 8. Follow-up Agenda

1. Confirm GTOP current data structure.
2. Define question bank verification rules.
3. Create verification ledger format.
4. Identify board/class/subject/question coverage gaps.
5. Define metadata fields:
   - question type
   - question pattern
   - topic tags
   - difficulty
   - source/status if needed
6. Plan AI-based tagging pipeline.
7. Design first version of Student Pulse.
8. Decide minimum data required for Pulse to work.
9. Run future education trend analysis for GTOP.
10. Convert this into CEO/Codex execution brief.
