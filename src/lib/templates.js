export const NOTE_TEMPLATES = [
  { id: 'blank', name: 'Blank', body: '', title: 'Untitled Note' },
  {
    id: 'lecture',
    name: 'Lecture',
    title: 'Lecture Notes',
    body: () => `## Date
${new Date().toLocaleDateString()}

## Topic


## Key Points
-
-
-

## Summary

`,
  },
  {
    id: 'lab',
    name: 'Lab Report',
    title: 'Lab Report',
    body: `## Experiment


## Hypothesis


## Procedure
1.
2.
3.

## Results


## Conclusion

`,
  },
  {
    id: 'reading',
    name: 'Reading Notes',
    title: 'Reading Notes',
    body: `## Title & Author


## Main Ideas
-
-
-

## Key Quotes
>

## Questions / Reflections

`,
  },
]

export function getTemplate(id) {
  return NOTE_TEMPLATES.find((t) => t.id === id) ?? NOTE_TEMPLATES[0]
}
