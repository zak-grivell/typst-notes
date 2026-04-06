#import "@preview/fletcher:0.5.8" as fletcher: diagram, edge, node
#import "@preview/catppuccin:1.1.0": catppuccin, flavors
#import "@preview/digestify:0.1.0": *

#let setup(body) = {
  set page(
    height: auto,
  )

  set text(font: "JetBrainsMono NF", size: 11pt)
  show: catppuccin.with(flavors.frappe)

  body
}

#let card_id = sys.inputs.at("card_id", default: none)
#let question_or_answer = sys.inputs.at("question_or_answer", default: false)

#let flashcard(q, a) = {
  let id = bytes-to-hex(sha256(bytes(repr(q))));

  [#metadata((kind:"flashcard", id: id, q: q, a: a)) <flashcard>]

  pagebreak()
  
  block(
    inset: 12pt, 
    radius: 4pt, 
    stroke: 0.5pt + gray,
    width: 100%,
    [#heading([#eval(q, mode: "markup", scope: (diagram: diagram, edge: edge, node:node))]) \ #eval(a, mode: "markup", scope: (diagram: diagram, edge: edge, node:node))]
  )
}
