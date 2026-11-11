import type { DiagramKind } from "@/lib/diagram-type";
import type { translate } from "@/lib/translate";

export interface Template {
  kind: DiagramKind;
  /** Key into the translation table, used as the display name. */
  label: keyof typeof translate;
  code: string;
}

export const TEMPLATES: Template[] = [
  {
    kind: "flowchart",
    label: "typeFlowchart",
    code: `flowchart TD
    Start(["Start"]) --> Input[/"Read user input"/]
    Input --> Valid{"Input valid?"}
    Valid -->|Yes| Process["Process request"]
    Valid -->|No| Error["Show error"]
    Error --> Input
    Process --> Store[("Save to database")]
    Store --> Done(["Done"])
`,
  },
  {
    kind: "sequence",
    label: "typeSequence",
    code: `sequenceDiagram
    autonumber
    participant U as User
    participant B as Browser
    participant S as Server
    U->>B: Open the page
    B->>S: GET /diagram
    S-->>B: 200 OK
    B-->>U: Render the diagram
    Note over U,B: Everything is stored locally
`,
  },
  {
    kind: "class",
    label: "typeClass",
    code: `classDiagram
    class Animal {
      +String name
      +int age
      +eat() void
    }
    class Dog {
      +bark() void
    }
    class Cat {
      +meow() void
    }
    Animal <|-- Dog
    Animal <|-- Cat
`,
  },
  {
    kind: "state",
    label: "typeState",
    code: `stateDiagram-v2
    [*] --> Idle
    Idle --> Loading: fetch
    Loading --> Success: ok
    Loading --> Failure: error
    Failure --> Loading: retry
    Success --> [*]
`,
  },
  {
    kind: "er",
    label: "typeEr",
    code: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "is in"
    CUSTOMER {
      string name
      string email
    }
    ORDER {
      int id
      date created
    }
`,
  },
  {
    kind: "gantt",
    label: "typeGantt",
    code: `gantt
    title Project plan
    dateFormat YYYY-MM-DD
    section Design
    Research      :done,    a1, 2025-01-01, 7d
    Wireframes    :active,  a2, after a1, 5d
    section Build
    Implementation :         b1, after a2, 14d
    Testing        :         b2, after b1, 7d
`,
  },
  {
    kind: "pie",
    label: "typePie",
    code: `pie title Time Distribution
    "Coding" : 40
    "Debugging" : 25
    "Learning" : 20
    "Coffee Break" : 15
`,
  },
  {
    kind: "journey",
    label: "typeJourney",
    code: `journey
    title My working day
    section Go to work
      Make tea: 5: Me
      Go upstairs: 3: Me
      Do work: 1: Me, Cat
    section Go home
      Go downstairs: 5: Me
      Sit down: 5: Me
`,
  },
  {
    kind: "git",
    label: "typeGit",
    code: `gitGraph
    commit
    commit
    branch develop
    checkout develop
    commit
    commit
    checkout main
    merge develop
    commit
`,
  },
  {
    kind: "mindmap",
    label: "typeMindmap",
    code: `mindmap
  root((Mermaid))
    Diagrams
      Flowchart
      Sequence
      Gantt
    Features
      Text based
      Export PNG
    Uses
      Docs
      Planning
`,
  },
  {
    kind: "timeline",
    label: "typeTimeline",
    code: `timeline
    title History of social media
    2002 : LinkedIn
    2004 : Facebook : Google
    2005 : YouTube
    2006 : Twitter
`,
  },
  {
    kind: "quadrant",
    label: "typeQuadrant",
    code: `quadrantChart
    title Reach and engagement
    x-axis Low Reach --> High Reach
    y-axis Low Engagement --> High Engagement
    quadrant-1 Expand
    quadrant-2 Promote
    quadrant-3 Re-evaluate
    quadrant-4 Improve
    Campaign A: [0.3, 0.6]
    Campaign B: [0.45, 0.23]
    Campaign C: [0.57, 0.69]
`,
  },
];

export const DEFAULT_CODE = TEMPLATES[0]!.code;
