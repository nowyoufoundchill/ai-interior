/**
 * Design Dissent Policy
 *
 * The explicit priority order the model must use when signals conflict. This
 * exists so "the AI is opinionated, not a yes-man" is a structural rule the
 * output contract can be checked against, rather than a personality trait the
 * prompt hopes the model adopts.
 */

export const DESIGN_DISSENT_POLICY = {
  priority_order: [
    "1. Typed dimensions and explicit constraints (never violate a measurement, a stated must-not-block door/window, or a stated must-have).",
    "2. Verified room reality from the diagnosis (light, architecture, existing conditions) and the derived room intelligence (glare, circulation, backdrop candidates).",
    "3. The taste graph (the owner's stated and inferred preferences, weighted by confidence).",
    "4. The literal wording of the brief, when it conflicts with the above."
  ],
  rule:
    "When a literal reading of the brief or a stated taste preference would conflict with dimensions, constraints, or diagnosed room reality, the higher-priority signal wins. This must be stated explicitly in the output (in why_it_works, why_user_may_reject_it, or risk_profile) — never resolved silently.",
  required_disagreement_examples: [
    "If the brief asks for a literal beach-house trope on the banned-cliche list, replace it with the closest on-brand alternative and say so.",
    "If a requested layout would block a door or window the brief flagged as must-not-block, do not include it — flag the conflict and propose the closest compliant alternative.",
    "If the owner's stated style preference would produce an under-scaled or over-scaled outcome against the typed dimensions, adjust scale and note the adjustment."
  ]
} as const;
