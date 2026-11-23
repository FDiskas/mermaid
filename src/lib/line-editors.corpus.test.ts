import { describe, expect, test } from "bun:test";
import { parseClassDiagram, serializeClassDiagram } from "./class-diagram";
import { parseEr, serializeEr } from "./er";
import { parseGitGraph, serializeGitGraph } from "./git-graph";
import type { LineModel } from "./line-model";
import { parseSequence, serializeSequence } from "./sequence";
import { parseState, serializeState } from "./state";

/**
 * Real-world syntax, including the parts the editors do not understand.
 * Two promises are checked for every sample:
 * 1. Reading and writing without an edit gives back the same text.
 * 2. When the editor has to write a line itself (after an edit), it writes a line it reads back the same way.
 */
interface Codec {
  parse(code: string): LineModel<{ type: string; origin?: unknown }> | null;
  serialize(model: never): string;
}

const SAMPLES: Record<string, { codec: Codec; samples: string[] }> = {
  sequence: {
    codec: { parse: parseSequence, serialize: serializeSequence as never },
    samples: [
      `sequenceDiagram
    title Order flow
    autonumber 10
    box Purple Alice & John
    participant A as Alice
    participant J as John
    end
    create participant C as Carl
    A->>C: Hello Carl
    A->>+J: Hello John, how are you?
    J-->>-A: Great!
    alt is sick
        J->>A: Not so good :(
    else is well
        J->>A: Feeling fresh like a daisy
    end
    par Alice to Bob
        A->>J: Hello
    and Alice to John
        A-)J: Hi
    end
    rect rgb(191, 223, 255)
    Note right of J: Rational thoughts <br/>prevail!
    end
    %% a comment
    A-xJ: lost
    A--)J: async
    destroy C
    A-xC: bye
    link A: Dashboard @ https://dashboard.contoso.com/alice
    participant D@{ "type" : "database" }
    A->>D: query; D->>A: rows
`,
      "sequenceDiagram\n    Alice->>John: Hello John, how are you?\n    John-->>Alice: Great!\n    Alice-)John: See you later!\n",
      "---\ntitle: Sequence\nconfig:\n  theme: forest\n---\n%%{init: {'theme': 'dark'}}%%\nsequenceDiagram\n    actor U\n    U->>U: think\n",
    ],
  },
  class: {
    codec: { parse: parseClassDiagram, serialize: serializeClassDiagram as never },
    samples: [
      `classDiagram
    direction RL
    title Shapes
    class Square~Shape~{
        int id
        List~int~ position
        setPoints(List~int~ points)
        getPoints() List~int~
    }
    class Animal["Animal with a label"]
    class Shape
    <<interface>> Shape
    Shape : +draw()
    class Duck {
        <<service>>
        +String beakColor
        +swim()$
    }
    namespace BaseShapes {
        class Triangle
        class Rectangle {
          double width
        }
    }
    Animal <|-- Duck
    Animal <|-- Fish
    Class01 "1" *-- "many" Class02 : contains
    Class03 o-- Class04 : aggregation
    Class09 --> C2 : Where am i?
    Class07 .. Class08
    Class10 ..|> Class11
    Class12 <.. Class13
    Class14 --|> Class15
    Class16 ()-- Class17
    link Shape "https://www.github.com" "This is a tooltip"
    callback Duck "callbackFunction" "Callback tooltip"
    cssClass "Animal" styleClass
    note for Duck "can fly\\ncan swim"
    note "General note"
    style Shape fill:#f9f,stroke:#333
`,
      "classDiagram-v2\n    class A\n    class B {\n    }\n    A --> B\n",
    ],
  },
  state: {
    codec: { parse: parseState, serialize: serializeState as never },
    samples: [
      `stateDiagram-v2
    direction LR
    accTitle: Machine
    accDescr: A machine
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash : boom
    Crash --> [*]
    state "Long description" as long
    long : More text
    state if_state <<choice>>
    [*] --> IsPositive
    IsPositive --> if_state
    if_state --> False: if n < 0
    if_state --> True : if n >= 0
    state fork_state <<fork>>
    [*] --> fork_state
    state join_state <<join>>
    state Active {
        [*] --> NumLockOff
        NumLockOff --> NumLockOn : EvNumLockPressed
        --
        [*] --> CapsLockOff
    }
    note right of Still
        multi line
    end note
    note left of Moving : short note
    classDef badBadEvent fill:#f00,color:white,font-weight:bold,stroke-width:2px,stroke:yellow
    class Crash badBadEvent
    Still:::badBadEvent
    A --> B; B --> C
%% comment
`,
      "---\ntitle: State\n---\nstateDiagram\n    s1 --> s2\n",
    ],
  },
  er: {
    codec: { parse: parseEr, serialize: serializeEr as never },
    samples: [
      `erDiagram
    title Shop
    direction LR
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses
    CUSTOMER {
        string name PK "the name"
        string custNumber UK
        string sector
        int id PK, FK
        varchar(255) email
    }
    p[Person] {
        string firstName
        string lastName
    }
    ORDER {
        int orderNumber PK
    }
    Empty {
    }
    CAR ||--o{ NAMED-DRIVER : allows
    PERSON }o..o{ NAMED-DRIVER : is
    PRODUCT ||--|| SPECS : "is described by"
    style CUSTOMER fill:#f9f,stroke:#333
    CUSTOMER:::someclass
    ORDER ||--|{ ITEM : "one or more"
    A one or zero to many B : text
`,
      "erDiagram\n    A ||--|| B : is\n",
    ],
  },
  git: {
    codec: { parse: parseGitGraph, serialize: serializeGitGraph as never },
    samples: [
      `gitGraph LR:
    commit
    commit id: "Alpha"
    commit id:"Beta" tag: "v1.0.0" type: HIGHLIGHT
    commit tag:"v2" type:REVERSE
    commit msg: "old syntax"
    branch develop order: 2
    branch "feature/login"
    checkout develop
    commit id: "ZERO"
    switch main
    cherry-pick id: "ZERO"
    commit
    merge develop id: "customID" tag: "customTag" type: REVERSE
    %% comment
    branch hotfix
`,
      "gitGraph:\n    commit\n",
    ],
  },
};

const strip = (model: LineModel<{ type: string; origin?: unknown }>) => ({
  ...model,
  entries: model.entries.map((entry) => ({ ...entry, origin: undefined })),
});
const types = (model: LineModel<{ type: string }>) => model.entries.map((entry) => entry.type);

for (const [name, { codec, samples }] of Object.entries(SAMPLES)) {
  describe(`${name} editor on real syntax`, () => {
    samples.forEach((sample, number) => {
      test(`sample ${number + 1} is written back unchanged`, () => {
        const model = codec.parse(sample);
        expect(model).not.toBeNull();
        expect(codec.serialize(model as never)).toBe(sample);
      });

      test(`sample ${number + 1}: lines the editor writes itself are read back the same way`, () => {
        const model = codec.parse(sample)!;
        const written = codec.serialize(strip(model) as never);
        const again = codec.parse(written)!;
        expect(types(again)).toEqual(types(model));
        expect(codec.serialize(strip(again) as never)).toBe(written);
      });
    });
  });
}
