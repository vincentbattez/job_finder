# A run's Inputs are inlined in its Prompt, so the Candidate sees exactly what the AI reads

A run used to name its Inputs by path in the Fixed Part and let the Claude session open them: the Job Description, the Chosen Versions it builds on, the whole Profile folder, whose Annexes the session judged worth reading or not, and how far, sometimes through a subagent. The V1's generation panel shows the Candidate each Input with its exact content and its weight in the Prompt, and « Copier le Prompt » copies what the AI receives (spec #125). The Prompt now carries the content of each checked Input under its own heading, never its path: the Fixed Part, then each Input, then the Instructions in effect, one Markdown document composed once for the preview and for the run. The session reads no Input from disk; it only writes the files of its Version, and searches the web for the Research and the Portrait.

## Considered Options

- **Paths in the Prompt, the session opening the files, as before.** Rejected: the preview would show paths, and the content and word counts beside them a guess of what the AI opens; nothing would tell whether it read an Annex in full, skimmed it or skipped it; and the copied Prompt would be useless off this machine.
- **Small Inputs inlined, long ones (the Annexes) left as paths.** Rejected: two ways to read an Input, and the preview would lie precisely on the heaviest ones, where the Candidate most needs to weigh them.

## Consequences

- The Prompt grows with every checked Input: an Annex costs its full length on every run that checks it, and a sent Letter its Original too. The Candidate weighs it from the recap's word counts and shares; Annexes unchecked by default and only the five most recent past letters checked keep the default Prompt small.
- The AI no longer chooses how far to read: the Profile's description loses its advice to skim a long Annex or hand it to a subagent, and the session no longer needs read access to the Profile or to other Postings' folders.
- What a Version records as its Inputs is what its session received, which makes the Inputs a Version shows exact.
