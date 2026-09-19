/** Explanations of the controller telemetry, not biological neuron annotations. */
export const SIGNAL_DETAILS: Record<string, { type: string; description: string; source: string }> =
  {
    odor: {
      type: 'External · food cue',
      description:
        'How close the nearest detectable food source feels. A brighter signal means food is nearer, not that more food remains.',
      source: 'Distance to the nearest food source with food remaining, within scent range.',
    },
    water: {
      type: 'External · water cue',
      description:
        'Proximity to detectable water. This is a simplified sensory cue, not a simulated visual image.',
      source: 'Distance to the nearest available water source within sight range.',
    },
    danger: {
      type: 'External · predator cue',
      description:
        'Proximity to a spider. It rises as a spider approaches, even when the spider has not started chasing.',
      source:
        'Distance to the nearest visible spider within sight range. Dense refuge cover blocks this cue.',
    },
    hunger: {
      type: 'Internal · nutritional need',
      description: 'The fly’s hunger level. A high value means a stronger need to eat.',
      source: 'Current hunger, scaled from 0 to 100%.',
    },
    thirst: {
      type: 'Internal · water deficit',
      description: 'The opposite of hydration: it rises as the fly loses water.',
      source: '100% minus the current hydration level.',
    },
    tired: {
      type: 'Internal · fatigue',
      description: 'Accumulated fatigue from moving. Rest allows this signal to fall.',
      source: 'Current fatigue, scaled from 0 to 100%.',
    },
    forage: {
      type: 'Derived · food motivation',
      description:
        'A summary of hunger and nearby food cues. A high value does not guarantee feeding: danger or thirst can take priority.',
      source: '80% of hunger plus 50% of the food cue, capped at 100%.',
    },
    hydrate: {
      type: 'Derived · water motivation',
      description:
        'A summary of thirst and nearby water cues. The controller also checks whether water can actually be reached.',
      source: '90% of thirst plus 50% of the water cue, capped at 100%.',
    },
    escape: {
      type: 'Derived · escape motivation',
      description:
        'Tracks the predator cue. Fleeing responds to nearby spiders. Spider pursuit has an eight-second budget followed by a twelve-second recovery gap; close contact remains dangerous.',
      source: 'The current predator proximity signal.',
    },
    recover: {
      type: 'Derived · rest motivation',
      description:
        'Fatigue raises this signal; nearby danger lowers it. Actual resting also depends on energy and the controller’s priorities.',
      source: 'Fatigue minus 70% of the predator cue, with a minimum of zero.',
    },
    explore: {
      type: 'Behavior · exploration state',
      description:
        'Reports whether the current action is exploration. This is a status signal, not curiosity, learning, or memory.',
      source: '75% while exploring; 8% during other actions.',
    },
    contact: {
      type: 'External · obstacle / touch cue',
      description:
        'Reports a collision or a nearby obstacle ahead. It is displayed among drive signals because it accompanies avoidance.',
      source: '100% after contact; otherwise the nearest forward obstacle’s proximity cue.',
    },
    forward: {
      type: 'Motor · movement command',
      description:
        'The requested forward movement, not measured travel speed. An obstacle can block motion even while this stays bright.',
      source: 'The controller’s movement command, scaled from 0 to 100%.',
    },
    left: {
      type: 'Motor · turning command',
      description:
        'The strength of the requested left turn. It summarizes steering toward resources, away from danger, or around obstacles.',
      source: 'The negative part of the turn command, capped at 100%.',
    },
    right: {
      type: 'Motor · turning command',
      description:
        'The strength of the requested right turn. It summarizes steering toward resources, away from danger, or around obstacles.',
      source: 'The positive part of the turn command, capped at 100%.',
    },
    feed: {
      type: 'Motor · feeding state',
      description:
        'The fly is requesting food consumption. Fruit is consumed only within reach; an exhausted or decayed patch supplies nothing, and later fruit can ripen elsewhere.',
      source: '100% while the selected action is feeding; otherwise zero.',
    },
    drink: {
      type: 'Motor · drinking state',
      description:
        'The fly is requesting water consumption. Water is consumed only if an available source is within reach.',
      source: '100% while the selected action is drinking; otherwise zero.',
    },
    rest: {
      type: 'Motor · resting state',
      description:
        'The selected action is rest. Fatigue falls, and adequate reserves allow energy recovery and slow injury repair when the fly is not being bitten.',
      source: '100% while the selected action is resting; otherwise zero.',
    },
  };
