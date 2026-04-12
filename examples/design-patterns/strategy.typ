#import "../../setup.typ": *
#show: setup.with()

= Strategy

Related notes:

- #link("./index.typ")[Index]
- #link("./observer.typ")[Observer]
- #link("./iterator.typ")[Iterator]

Strategy encapsulates interchangeable algorithms behind a common interface.

#flashcard(
  "What changes when you use Strategy?",
  "The algorithm can vary independently from the code that uses it.",
)

#flashcard(
  "When is Strategy a good fit?",
  "When you have several variants of behavior and want to swap them without branching all over the caller.",
)
