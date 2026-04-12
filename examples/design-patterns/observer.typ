#import "../../setup.typ": *
#show: setup.with()

= Observer

Related notes:

- #link("./index.typ")[Index]
- #link("./strategy.typ")[Strategy]

The observer pattern defines a one-to-many dependency so that when one object changes state, all dependents are notified.

#flashcard(
  "What problem does Observer solve?",
  "Keeping multiple dependents in sync with one subject without hard-coding each dependency.",
)

#flashcard(
  "What are the core roles in Observer?",
  "A subject that publishes changes and observers that subscribe and react.",
)
