import {
  ArrowUpRight,
  BookOpen,
  Compass,
  Fingerprint,
  FlaskConical,
  GitBranch,
  Waves,
} from 'lucide-react';
import './Tutorial.css';

const steps = [
  {
    icon: Fingerprint,
    title: 'Meet this individual',
    text: 'Choose “Name this fly” below the habitat. Renaming keeps the same life. “New generation” archives it and starts another individual.',
  },
  {
    icon: Compass,
    title: 'Watch one decision',
    text: 'Observe at 1×, then pause. Compare the fly’s action with hunger, hydration and arousal. Follow a change in the inputs before interpreting the response.',
  },
  {
    icon: GitBranch,
    title: 'Read the signals',
    text: 'Hover, focus or tap a Brain Activity node. Its inspector explains the live value and illustrated connections. Pin it to follow that channel over time.',
  },
  {
    icon: FlaskConical,
    title: 'Ask a memory question',
    text: 'Open Research → Memory assay. Compare the two odors, inspect the synaptic weights, then explore retention or extinction. Read the protocol before comparing results.',
  },
];

/** A practical guide; it deliberately does not invent lesson progress or achievements. */
export function Tutorial() {
  return (
    <section className="observation-guide" aria-label="MOSK observation and research tutorial">
      <header className="guide-intro">
        <span className="guide-kicker">
          <BookOpen size={14} /> FIELD GUIDE
        </span>
        <h3>Start with a question.</h3>
        <p>
          A name, a signal, a controlled comparison. Small observations make the model easier to
          understand.
        </p>
      </header>

      <ol className="guide-steps">
        {steps.map(({ icon: Icon, title, text }, index) => (
          <li key={title}>
            <div className="guide-step-icon">
              <Icon size={18} />
              <span>{String(index + 1).padStart(2, '0')}</span>
            </div>
            <h4>{title}</h4>
            <p>{text}</p>
          </li>
        ))}
      </ol>

      <div className="guide-model-boundary">
        <FlaskConical size={18} />
        <p>
          <strong>Three views, three meanings.</strong> The habitat runs a sensory utility
          controller. The MaleCNS atlas shows real anatomical annotations. The memory assay runs a
          separate published mushroom-body model; its learned weights do not steer the roaming fly.
        </p>
      </div>

      <div className="guide-details">
        <details>
          <summary>
            Move around the habitat <Compass size={15} />
          </summary>
          <div>
            <p>
              Drag the map to pan, or focus it and use the arrow keys. Press <kbd>F</kbd> or choose
              Follow fly to return. Scroll the mouse wheel over the map to zoom, or use the zoom
              buttons. In free-camera mode, wheel zoom stays anchored beneath the pointer.
              Fullscreen keeps the compact vital signs visible alongside the map.
            </p>
            <p>
              Only the fly’s exploration reveals new terrain. Camera movement does not clear fog.
              This is the observer’s map record; the utility controller does not remember a route
              through it.
            </p>
            <p>
              <Waves size={14} className="guide-inline-icon" /> Food scent field adds a soft visual
              cue around food. Its low contrast is a display choice and does not change what the fly
              senses. Movement trail shows its recent path.
            </p>
            <p>
              The leafy inner refuge excludes spiders; the outer rim still carries risk. Hunger and
              thirst continue inside. Cover, predator behavior and metabolism are habitat
              abstractions, not measured MaleCNS physiology.
            </p>
            <p>
              Fruit can be eaten or decay, disappear, and later ripen at a new location. Water
              refills slowly at its pond. The small icon-and-number strip repeats the six vital
              signs; hover or focus an icon to identify it. The full explanations remain below.
            </p>
            <p>
              Only one spider can chase at a time, for up to eight simulation seconds, followed by
              twelve seconds without a new pursuit. Contact still causes injury. Health tracks
              injury: bites and severe deprivation reduce it. Recovery requires rest and adequate
              reserves; a fly that avoids injury can still stay at 100%.
            </p>
          </div>
        </details>
        <details>
          <summary>
            Understand the memory log <GitBranch size={15} />
          </summary>
          <div>
            <p>
              The assay displays numerical circuit state and saves a replay checkpoint. Its table
              contains plastic synaptic weights for two odor inputs across three modeled pathways.
              Compare the current weights with their starting values and with the previous bout.
            </p>
            <p>
              Six rate readouts describe the model’s response for each completed bout. A changing
              activity rate is a temporary response; a changed synaptic weight is a stored change in
              the model. Neither is a remembered sentence or a location on the map.
            </p>
            <p>
              Conditioning pairs an odor with a teaching signal. Retention examines the state after
              a delay. Extinction presents the cue without reinforcement. Use matched protocols to
              interpret differences; a single changing number is not enough to establish a
              biological result.
            </p>
            <p>
              The assay follows the published bout timing. Conditioning, retention, extinction and a
              feedback control use the source protocols. Its biological seconds are separate from
              hunger, danger and elapsed time in the habitat.
            </p>
          </div>
        </details>
        <details>
          <summary>
            Keep and compare a life <Fingerprint size={15} />
          </summary>
          <div>
            <p>
              Names, habitat state and the attached assay checkpoint are saved with each individual.
              Reloading replays the recorded protocol to reconstruct the same weights. Export
              experiment creates a portable JSON copy; importing replaces this device’s current
              experiment and archive.
            </p>
            <p>
              A new generation starts fresh controller and assay state. Previous records remain in
              the journal for comparison and are not inherited. “Generation” is an experiment label;
              there is no genetic evolution system.
            </p>
            <p>
              Every new-life dialog starts with Sensory utility model selected. Choose Random
              baseline explicitly when you want that comparison.
            </p>
            <p>
              In Experiment journal, choose a life under Viewing and expand Inspect saved memory
              assay. Its temporary replay lets you inspect the recorded weights without changing the
              saved checkpoint.
            </p>
            <p>
              Age is elapsed simulation time. Aging and a fixed maximum lifespan are not modeled.
              Time does not advance while the page is hidden.
            </p>
          </div>
        </details>
        <details>
          <summary>
            Know what the atlas tells you <BookOpen size={15} />
          </summary>
          <div>
            <p>
              Open Research → MaleCNS atlas. MaleCNS is an anatomical reconstruction from the FlyEM
              collaboration, including Google Research. The atlas uses source annotations and
              identifiers so you can inspect what a named cell represents.
            </p>
            <p>
              The atlas does not provide live activity for those cells. The 18 habitat signals are
              controller channels, not 18 selected MaleCNS neurons. MOSK does not load and execute
              the entire male nervous system.
            </p>
            <p>
              The learning assay comes from Huang, Luo and colleagues’ separate 2024 mushroom-body
              study. Its source, equations, parameters and license are identified with the
              experiment.
            </p>
          </div>
        </details>
      </div>

      <footer className="guide-sources">
        <span>Follow the evidence</span>
        <a href="https://male-cns.janelia.org/" target="_blank" rel="noreferrer">
          MaleCNS project <ArrowUpRight size={13} />
        </a>
        <a
          href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11525173/"
          target="_blank"
          rel="noreferrer"
        >
          Memory study <ArrowUpRight size={13} />
        </a>
        <a
          href="https://github.com/schnitzer-lab/Luo_Huang_2024_MB_model"
          target="_blank"
          rel="noreferrer"
        >
          Authors’ model <ArrowUpRight size={13} />
        </a>
      </footer>
    </section>
  );
}
