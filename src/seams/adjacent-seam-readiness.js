import { fileURLToPath } from 'node:url'

import { readAdjacentSeamReadiness } from './adjacent-seam-needs.js'

const modulePath = fileURLToPath(import.meta.url)
const defaultProjectDir = 'examples/card-to-candidate'

function parseArgs(argv) {
  const args = {
    projectDir: defaultProjectDir,
    print: false,
    quiet: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--project-dir') {
      args.projectDir = next
      i += 1
    } else if (arg === '--print') {
      args.print = true
    } else if (arg === '--quiet') {
      args.quiet = true
    }
  }

  return args
}

export async function inspectAdjacentSeamReadiness({
  projectDir = defaultProjectDir,
  print = false,
  quiet = false
} = {}) {
  const readiness = await readAdjacentSeamReadiness({ projectDir })

  if (print) {
    console.log(JSON.stringify(readiness, null, 2))
  } else if (!quiet) {
    console.log(formatAdjacentSeamReadiness(readiness))
  }

  return {
    readiness
  }
}

export function formatAdjacentSeamReadiness(readiness) {
  return [
    `studio adjacent seam readiness: project=${readiness.projectId}`,
    `readiness=${readiness.readiness}`,
    `proof=${readiness.proofState}`,
    `proofFreshness=${readiness.proofFreshness}`,
    `proofDrill=${readiness.proofDrill}`,
    `drillAttentionReasons=${formatStaleReasons(readiness.proofDrillAttentionReasons)}`,
    `adjacentPackets=${readiness.adjacentPackets}`,
    `adjacentFreshness=${readiness.adjacentFreshness}`,
    `staleReasons=${formatStaleReasons(readiness.staleReasons)}`,
    `declaration=${readiness.declarationStatus}`,
    `familyBuildout=${readiness.familyBuildoutCoordination ?? readiness.spineDiscussion}`,
    `familyReadiness=${readiness.familyBuildoutReadiness ?? readiness.readiness}`,
    `spineDiscussion=${readiness.spineDiscussion}`,
    `adjacentNeeds=${readiness.adjacentNeeds}`,
    `adjacentReady=${readiness.adjacentReady}`,
    `adjacentAttention=${readiness.adjacentAttention}`,
    'adjacentRepoWrite=false',
    'layerAdmission=false',
    'durableAppend=false',
    'edgeQueueAction=false',
    'edgeDispatch=false',
    'edgeRuntimeVerified=false',
    'bytesMaterialization=false',
    'causalTruth=false',
    'acceptedContinuity=false',
    'resultAcceptance=false',
    'storageSelection=false',
    'publicationAuthorization=false',
    'productionReady=false',
    'swarmRuntimeActivated=false',
    `familyNextAction=${readiness.familyBuildoutNextAction ?? readiness.safeNextAction}`,
    `nextAction=${readiness.safeNextAction}`
  ].join(' | ')
}

function formatStaleReasons(staleReasons = []) {
  return staleReasons.length > 0 ? staleReasons.join(',') : 'none'
}

if (process.argv[1] === modulePath) {
  await inspectAdjacentSeamReadiness(parseArgs(process.argv.slice(2)))
}
