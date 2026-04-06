#import "../../setup.typ": *
#show: setup.with()

= Iterator

Related notes:

- #link("./index.typ")[Index]
- #link("./strategy.typ")[Strategy]

Iterator provides a way to access elements of a collection sequentially without exposing the collection's internal representation.

#flashcard(
  [What does Iterator hide from the caller?],
  [The internal structure and traversal details of the collection.],
)

#flashcard(
  [Why is Iterator useful?],
  [It separates traversal logic from collection logic and gives clients a stable way to consume sequences.],
)
