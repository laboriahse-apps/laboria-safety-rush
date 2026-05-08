"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type GamePhase = "home" | "briefing" | "playing" | "results";
type DifficultyId = "easy" | "normal" | "expert";
type ScenarioId =
  | "warehouse"
  | "office"
  | "construction"
  | "workshop"
  | "restaurant-kitchen"
  | "hospital"
  | "laboratory"
  | "hotel-housekeeping"
  | "retail-store"
  | "school-education"
  | "automotive-garage"
  | "chemical-storage"
  | "loading-dock";
type ConfirmationAction = "home" | "restart";
type Feedback = {
  tone: "success" | "danger" | "info";
  text: string;
};
type SoundKind = "correct" | "wrong" | "hint" | "complete";
type ResultPdfData = {
  accuracy: number;
  completedAt: string;
  difficulty: string;
  finalScore: number;
  foundCount: number;
  hintsUsed: number;
  maxTotalScore: number;
  playerName: string;
  rank: string;
  scenarioTitle: string;
  scorePercentage: number;
  timeLeft: number;
  totalHazards: number;
  wrongClicks: number;
};
type LocalResult = {
  completedAt: string;
  difficulty: string;
  finalScore: number;
  hazardsFound: number;
  maxScore: number;
  playerName: string;
  playerSurname: string;
  rankTitle: string;
  scenarioId: ScenarioId;
  scenarioName: string;
  scorePercentage: number;
  timeRemaining: number;
  totalHazards: number;
  wrongClicks: number;
};

type Hazard = {
  id: string;
  name: string;
  label: string;
  explanation: string;
  hint: string;
  resolvedEffect?: "access" | "spill" | "cable" | "load" | "label" | "ppe" | "path" | "extinguisher" | "drawer" | "ergonomic" | "power";
  resolvedLabel: string;
  resolvedMarker?: {
    left: number;
    top: number;
  };
  hotspotPriority?: number;
  hotspot: {
    height: number;
    left: number;
    top: number;
    width: number;
  };
};

type Scenario = {
  hazards: Hazard[];
  id: ScenarioId;
  isAvailable: boolean;
  missionBriefingText: string;
  previewImage: string;
  resultTitle: string;
  sceneImage: string;
  subtitle: string;
  title: string;
};

const SHOW_HOTSPOT_DEBUG = false;
const CORRECT_HAZARD_POINTS = 10;
const HINT_PENALTY = 5;
const LOCAL_RESULTS_KEY = "laboriaSafetyRushResults";
const MAX_LOCAL_RESULTS = 100;
const LIVE_APP_URL = "https://laboria-safety-rush.vercel.app";

const difficulties: Record<
  DifficultyId,
  {
    description: string;
    hints: number;
    label: string;
    seconds: number;
    wrongClickPenalty: number;
  }
> = {
  easy: {
    description: "90 seconds, lighter wrong-click penalty",
    hints: 3,
    label: "Easy",
    seconds: 90,
    wrongClickPenalty: 3,
  },
  normal: {
    description: "60 seconds, standard inspection pace",
    hints: 2,
    label: "Normal",
    seconds: 60,
    wrongClickPenalty: 5,
  },
  expert: {
    description: "45 seconds, strict wrong-click penalty",
    hints: 1,
    label: "Expert",
    seconds: 45,
    wrongClickPenalty: 8,
  },
};

const difficultyOptions = Object.entries(difficulties) as Array<[DifficultyId, (typeof difficulties)[DifficultyId]]>;

const warehouseHazards: Hazard[] = [
  {
    id: "exit",
    name: "Blocked emergency exit",
    label: "EXIT",
    explanation:
      "Emergency exits must stay visible and clear so people can evacuate immediately during an incident.",
    hint: "Check the emergency exit route.",
    resolvedEffect: "access",
    resolvedLabel: "Access cleared",
    hotspot: { left: 15.2, top: 17.2, width: 14.2, height: 38.5 },
  },
  {
    id: "spill",
    name: "Spilled liquid",
    label: "SPILL",
    explanation:
      "Spills should be isolated and cleaned quickly to prevent slips, falls, and contamination.",
    hint: "Inspect the floor for slip or trip hazards.",
    resolvedEffect: "spill",
    resolvedLabel: "Spill controlled",
    hotspot: { left: 3.6, top: 63.8, width: 33.8, height: 14.8 },
  },
  {
    id: "cable",
    name: "Damaged electrical cable",
    label: "CABLE",
    explanation:
      "Damaged cables can cause shocks, burns, or fires and should be taken out of service until repaired.",
    hint: "Inspect power leads and floor-level electrical hazards.",
    resolvedEffect: "cable",
    resolvedLabel: "Cable isolated",
    hotspot: { left: 0, top: 80.8, width: 33.2, height: 16.2 },
  },
  {
    id: "shelf",
    name: "Overloaded shelf",
    label: "LOAD",
    explanation:
      "Shelving must respect load limits and keep heavy items low to reduce collapse and strike hazards.",
    hint: "Review the storage rack stability.",
    resolvedEffect: "load",
    resolvedLabel: "Load secured",
    hotspot: { left: 36.3, top: 0.8, width: 29.8, height: 55.8 },
  },
  {
    id: "chemical",
    name: "Unlabeled chemical container",
    label: "CHEM",
    explanation:
      "Chemical containers need clear labels so workers can identify contents, risks, and handling controls.",
    hint: "Check chemical storage controls.",
    resolvedEffect: "label",
    resolvedLabel: "Label applied",
    hotspot: { left: 66.4, top: 16.1, width: 14.3, height: 45.6 },
  },
  {
    id: "ppe",
    name: "Missing PPE station",
    label: "PPE",
    explanation:
      "PPE stations should be stocked and easy to access before workers enter controlled task areas.",
    hint: "Review the PPE station for missing required equipment.",
    resolvedEffect: "ppe",
    resolvedLabel: "PPE restored",
    hotspot: { left: 81.5, top: 14.2, width: 17.3, height: 43.2 },
  },
  {
    id: "forklift",
    name: "Forklift path obstruction",
    label: "PATH",
    explanation:
      "Forklift travel lanes must be separated and free of obstacles to prevent collisions and load shifts.",
    hint: "Inspect marked vehicle routes for obstructions.",
    resolvedEffect: "path",
    resolvedLabel: "Path cleared",
    hotspot: { left: 52.8, top: 55.4, width: 23.8, height: 24.9 },
  },
  {
    id: "extinguisher",
    name: "Blocked fire extinguisher",
    label: "FIRE",
    explanation:
      "Fire extinguishers must remain mounted, marked, inspected, and reachable without moving inventory.",
    hint: "Look at fire readiness equipment.",
    resolvedEffect: "extinguisher",
    resolvedLabel: "Extinguisher accessible",
    hotspot: { left: 3.2, top: 29.4, width: 11.2, height: 24.5 },
  },
];

const officeHazards: Hazard[] = [
  {
    id: "office-cable",
    name: "Trailing cable across walkway",
    label: "CABLE",
    explanation:
      "Walkways should be kept clear of trailing cables to prevent trips and maintain safe access routes.",
    hint: "Inspect floor-level trip hazards along walkways.",
    resolvedEffect: "cable",
    resolvedLabel: "Cable routed",
    resolvedMarker: { left: 55, top: 72 },
    hotspot: { left: 36.5, top: 50.8, width: 39.5, height: 39.5 },
  },
  {
    id: "office-power",
    name: "Overloaded power strip",
    label: "POWER",
    explanation:
      "Power strips should not be overloaded because excess load can overheat equipment and increase fire risk.",
    hint: "Check electrical outlets and plugged-in equipment.",
    resolvedEffect: "power",
    resolvedLabel: "Power isolated",
    resolvedMarker: { left: 48, top: 28 },
    hotspot: { left: 72.5, top: 79.5, width: 19, height: 16 },
  },
  {
    id: "office-extinguisher",
    name: "Blocked fire extinguisher",
    label: "FIRE",
    explanation:
      "Fire extinguishers must remain clearly visible and accessible without moving furniture or storage.",
    hint: "Look at fire readiness equipment.",
    resolvedEffect: "extinguisher",
    resolvedLabel: "Access cleared",
    resolvedMarker: { left: 42, top: 24 },
    hotspot: { left: 81.5, top: 44, width: 10, height: 34 },
  },
  {
    id: "office-drawer",
    name: "Open file cabinet drawer",
    label: "DRAWER",
    explanation:
      "Open drawers create strike and trip hazards and should be closed when not actively in use.",
    hint: "Inspect storage furniture for protruding objects.",
    resolvedEffect: "drawer",
    resolvedLabel: "Drawer closed",
    resolvedMarker: { left: 46, top: 42 },
    hotspot: { left: 62.5, top: 54.5, width: 14, height: 17 },
  },
  {
    id: "office-ergonomics",
    name: "Poor workstation ergonomics",
    label: "ERGON",
    explanation:
      "Workstations should support neutral posture, suitable screen height, and safe reach distances.",
    hint: "Review workstation setup and posture risks.",
    resolvedEffect: "ergonomic",
    resolvedLabel: "Workstation adjusted",
    resolvedMarker: { left: 58, top: 32 },
    hotspot: { left: 5.5, top: 20.2, width: 31, height: 50 },
  },
  {
    id: "office-spill",
    name: "Spilled drink/liquid on floor",
    label: "SPILL",
    explanation:
      "Floor spills should be isolated and cleaned promptly to prevent slips and falls.",
    hint: "Inspect the floor for slip hazards.",
    resolvedEffect: "spill",
    resolvedLabel: "Spill controlled",
    resolvedMarker: { left: 48, top: 34 },
    hotspot: { left: 28, top: 83, width: 21, height: 15 },
  },
  {
    id: "office-boxes",
    name: "Unstable stacked boxes/files",
    label: "BOXES",
    explanation:
      "Stacked boxes should be stable, kept at safe heights, and stored away from walkways.",
    hint: "Review storage stability and walkway clearance.",
    resolvedEffect: "load",
    resolvedLabel: "Storage secured",
    resolvedMarker: { left: 48, top: 64 },
    hotspot: { left: 70.5, top: 0.8, width: 22.5, height: 26 },
  },
  {
    id: "office-exit",
    name: "Blocked emergency exit",
    label: "EXIT",
    explanation:
      "Emergency exits must remain unobstructed and clearly accessible for fast evacuation.",
    hint: "Check the emergency exit route.",
    resolvedEffect: "access",
    resolvedLabel: "Exit cleared",
    resolvedMarker: { left: 52, top: 22 },
    hotspot: { left: 47.5, top: 19, width: 12.5, height: 31 },
  },
];

const constructionHazards: Hazard[] = [
  {
    id: "construction-guardrail",
    name: "Missing guardrail at open edge",
    label: "EDGE",
    explanation: "Open edges must be protected to prevent falls from height.",
    hint: "Inspect open edges and fall protection.",
    resolvedEffect: "access",
    resolvedLabel: "Edge protected",
    resolvedMarker: { left: 54, top: 36 },
    hotspotPriority: 20,
    hotspot: { left: 0, top: 36, width: 16.5, height: 43 },
  },
  {
    id: "construction-walkway",
    name: "Walkway blocked by construction materials",
    label: "PATH",
    explanation: "Walkways must stay clear to prevent trips and allow safe movement.",
    hint: "Check temporary access routes.",
    resolvedEffect: "path",
    resolvedLabel: "Walkway cleared",
    resolvedMarker: { left: 50, top: 46 },
    hotspot: { left: 39, top: 26, width: 25, height: 25 },
  },
  {
    id: "construction-rebar",
    name: "Exposed rebar without protective caps",
    label: "REBAR",
    explanation: "Rebar ends must be capped or protected to prevent impalement injuries.",
    hint: "Look for exposed reinforcement hazards.",
    resolvedEffect: "load",
    resolvedLabel: "Rebar capped",
    resolvedMarker: { left: 50, top: 36 },
    hotspotPriority: 40,
    hotspot: { left: 18.5, top: 55, width: 9.5, height: 40 },
  },
  {
    id: "construction-ladder",
    name: "Unsecured ladder",
    label: "LADDER",
    explanation: "Ladders must be secured and positioned at a safe angle before use.",
    hint: "Review ladder positioning.",
    resolvedEffect: "load",
    resolvedLabel: "Ladder secured",
    resolvedMarker: { left: 54, top: 42 },
    hotspot: { left: 61.5, top: 7, width: 13, height: 56 },
  },
  {
    id: "construction-cable",
    name: "Electrical cable across walkway",
    label: "CABLE",
    explanation: "Temporary cables must be routed or protected to prevent trip and electrical hazards.",
    hint: "Inspect temporary electrical cable routing.",
    resolvedEffect: "cable",
    resolvedLabel: "Cable routed",
    resolvedMarker: { left: 56, top: 54 },
    hotspotPriority: 10,
    hotspot: { left: 23, top: 56, width: 44, height: 40 },
  },
  {
    id: "construction-ppe",
    name: "Missing PPE station",
    label: "PPE",
    explanation: "Required PPE must be available before entering controlled work areas.",
    hint: "Check whether PPE is ready for use.",
    resolvedEffect: "ppe",
    resolvedLabel: "PPE restored",
    resolvedMarker: { left: 51, top: 35 },
    hotspot: { left: 76, top: 11, width: 14, height: 36 },
  },
  {
    id: "construction-floor-hole",
    name: "Open floor hole / uncovered opening",
    label: "OPENING",
    explanation: "Floor openings must be covered, guarded, or clearly controlled.",
    hint: "Look for floor openings.",
    resolvedEffect: "access",
    resolvedLabel: "Opening covered",
    resolvedMarker: { left: 48, top: 44 },
    hotspot: { left: 59, top: 69, width: 23, height: 22 },
  },
  {
    id: "construction-extinguisher",
    name: "Fire extinguisher blocked by construction materials",
    label: "FIRE",
    explanation: "Fire equipment must remain visible and accessible at all times.",
    hint: "Check access to fire equipment.",
    resolvedEffect: "extinguisher",
    resolvedLabel: "Access cleared",
    resolvedMarker: { left: 42, top: 35 },
    hotspot: { left: 90.5, top: 48, width: 9.5, height: 31 },
  },
];

const workshopHazards: Hazard[] = [
  {
    id: "workshop-machine",
    name: "Unguarded rotating machine",
    label: "GUARD",
    explanation: "Rotating machinery must have effective guarding to prevent contact with moving parts.",
    hint: "Inspect the rotating machinery guarding.",
    resolvedEffect: "load",
    resolvedLabel: "Guard restored",
    hotspotPriority: 20,
    hotspot: { left: 0, top: 36, width: 24.5, height: 27 },
  },
  {
    id: "workshop-rag",
    name: "Loose rag or cloth near moving parts",
    label: "RAG",
    explanation: "Loose materials near moving machinery can be caught and create entanglement hazards.",
    hint: "Check around moving parts for loose materials.",
    resolvedEffect: "load",
    resolvedLabel: "Rag removed",
    resolvedMarker: { left: 48, top: 42 },
    hotspotPriority: 35,
    hotspot: { left: 15.5, top: 58.5, width: 14.5, height: 16 },
  },
  {
    id: "workshop-spill",
    name: "Oil spill on the floor",
    label: "SPILL",
    explanation: "Oil spills must be controlled immediately to prevent slips and falls.",
    hint: "Inspect the floor for slip hazards.",
    resolvedEffect: "spill",
    resolvedLabel: "Spill controlled",
    hotspot: { left: 37, top: 73, width: 28, height: 23 },
  },
  {
    id: "workshop-cable",
    name: "Air hose or power cable trailing across walkway",
    label: "CABLE",
    explanation: "Cables and hoses across walkways must be routed or protected to prevent trips.",
    hint: "Check the main walking path.",
    resolvedEffect: "cable",
    resolvedLabel: "Cable routed",
    hotspot: { left: 27.5, top: 42, width: 36.5, height: 38 },
  },
  {
    id: "workshop-cylinder",
    name: "Unsecured gas cylinder",
    label: "GAS",
    explanation: "Gas cylinders must be secured upright to prevent falling and valve damage.",
    hint: "Inspect compressed gas storage.",
    resolvedEffect: "load",
    resolvedLabel: "Cylinder secured",
    hotspot: { left: 59.2, top: 22, width: 7.8, height: 41.5 },
  },
  {
    id: "workshop-flammables",
    name: "Flammable liquid stored near sparks or hot work",
    label: "FIRE",
    explanation: "Flammable liquids must be stored away from ignition sources and hot work.",
    hint: "Check flammable storage near hot work.",
    resolvedEffect: "extinguisher",
    resolvedLabel: "Flammables moved",
    hotspot: { left: 68.5, top: 28, width: 17, height: 33 },
  },
  {
    id: "workshop-tools",
    name: "Tools scattered on workbench edge / poor housekeeping",
    label: "TOOLS",
    explanation: "Tools should be stored safely and kept away from bench edges to prevent falling objects and cuts.",
    hint: "Review housekeeping on work surfaces.",
    resolvedEffect: "load",
    resolvedLabel: "Tools secured",
    hotspot: { left: 69, top: 51, width: 30, height: 21 },
  },
  {
    id: "workshop-ppe",
    name: "Missing PPE from PPE station",
    label: "PPE",
    explanation: "Required PPE must be available and easy to access before starting workshop tasks.",
    hint: "Check the PPE station or safety equipment board.",
    resolvedEffect: "ppe",
    resolvedLabel: "PPE restored",
    resolvedMarker: { left: 50, top: 42 },
    hotspot: { left: 83.5, top: 7.5, width: 15.5, height: 35 },
  },
];

const restaurantKitchenHazards: Hazard[] = [
  {
    id: "kitchen-spill",
    name: "Grease / wet spill on the floor",
    label: "SPILL",
    explanation: "Grease or liquid on the floor creates a slip hazard and must be cleaned immediately.",
    hint: "Check the floor in the main walking path.",
    resolvedEffect: "spill",
    resolvedLabel: "SPILL CONTROLLED",
    hotspot: { left: 28, top: 76, width: 28, height: 21 },
  },
  {
    id: "kitchen-knife",
    name: "Knife left near the edge of prep table",
    label: "KNIFE",
    explanation: "Sharp tools left near the table edge can fall or cause cuts and should be stored safely.",
    hint: "Inspect the prep table edge.",
    resolvedEffect: "load",
    resolvedLabel: "KNIFE STORED",
    hotspotPriority: 35,
    hotspot: { left: 1.5, top: 61, width: 20, height: 10 },
  },
  {
    id: "kitchen-heavy-pot",
    name: "Heavy pot stored too high / unsafe manual handling",
    label: "LOAD",
    explanation: "Heavy items stored too high increase the risk of strain injuries and falling objects during lifting.",
    hint: "Look at the upper storage shelf.",
    resolvedEffect: "load",
    resolvedLabel: "LOAD LOWERED",
    hotspot: { left: 12.5, top: 1.5, width: 22, height: 21 },
  },
  {
    id: "kitchen-pan-handle",
    name: "Hot pan handle sticking outward",
    label: "HANDLE",
    explanation:
      "Pan handles should not project outward into work areas because they can be knocked, causing burns or spills.",
    hint: "Check pan handle direction on the cook line.",
    resolvedEffect: "load",
    resolvedLabel: "HANDLE TURNED IN",
    resolvedMarker: { left: 52, top: 40 },
    hotspotPriority: 50,
    hotspot: { left: 48.5, top: 34.8, width: 19.5, height: 7.4 },
  },
  {
    id: "kitchen-towel",
    name: "Dish towel too close to hot burner / flame",
    label: "TOWEL",
    explanation: "Cloths and towels must be kept away from burners and hot surfaces to prevent fire.",
    hint: "Look near the active burner or flame.",
    resolvedEffect: "load",
    resolvedLabel: "TOWEL REMOVED",
    resolvedMarker: { left: 48, top: 40 },
    hotspotPriority: 45,
    hotspot: { left: 60.5, top: 47, width: 12, height: 17 },
  },
  {
    id: "kitchen-fryer",
    name: "Unsafe deep fryer / exposed hot oil",
    label: "FRYER",
    explanation: "Exposed or unmanaged hot oil creates a serious burn and splash hazard and must be controlled safely.",
    hint: "Inspect the fryer area.",
    resolvedEffect: "spill",
    resolvedLabel: "FRYER MADE SAFE",
    hotspot: { left: 75.5, top: 30, width: 19, height: 28 },
  },
  {
    id: "kitchen-oven-door",
    name: "Open oven door into walkway",
    label: "DOOR",
    explanation:
      "Open equipment doors in walkways create trip and collision hazards and should be kept closed when not in use.",
    hint: "Check equipment doors near the walkway.",
    resolvedEffect: "drawer",
    resolvedLabel: "DOOR CLOSED",
    hotspot: { left: 43, top: 58, width: 20, height: 19 },
  },
  {
    id: "kitchen-blocked-path",
    name: "Blocked kitchen walkway with crates or trays",
    label: "PATH",
    explanation:
      "Walkways must remain clear to prevent trips, collisions, and blocked movement during kitchen operations.",
    hint: "Inspect the side walkway and crates.",
    resolvedEffect: "path",
    resolvedLabel: "PATH CLEARED",
    hotspot: { left: 67, top: 60, width: 31, height: 34 },
  },
];

const scenarios: Scenario[] = [
  {
    hazards: warehouseHazards,
    id: "warehouse",
    isAvailable: true,
    missionBriefingText:
      "Inspect the warehouse scene for blocked access, storage risks, vehicle-route obstructions, chemicals, fire controls, and electrical hazards.",
    previewImage: "/warehouse-scene.jpg",
    resultTitle: "Warehouse Safety Challenge Result",
    sceneImage: "/warehouse-scene.jpg",
    subtitle: "Identify operational HS hazards across storage, access, fire readiness, and warehouse traffic routes.",
    title: "Warehouse",
  },
  {
    hazards: officeHazards,
    id: "office",
    isAvailable: true,
    missionBriefingText:
      "Inspect the office scene for trip hazards, electrical loading, workstation ergonomics, storage issues, spills, and emergency readiness.",
    previewImage: "/scenarios/office/office-scene.png",
    resultTitle: "Office Safety Challenge Result",
    sceneImage: "/scenarios/office/office-scene.png",
    subtitle: "Find common office HS hazards affecting walkways, fire readiness, electrical safety, and ergonomics.",
    title: "Office",
  },
  {
    hazards: constructionHazards,
    id: "construction",
    isAvailable: true,
    missionBriefingText:
      "Inspect the construction site for fall protection, access-route obstructions, exposed reinforcement, ladder safety, temporary electrical routing, PPE readiness, floor openings, and fire equipment access.",
    previewImage: "/scenarios/construction/construction-scene.png",
    resultTitle: "Construction Site Safety Challenge Result",
    sceneImage: "/scenarios/construction/construction-scene.png",
    subtitle: "Site access, working at height, plant movement, and PPE controls.",
    title: "Construction Site",
  },
  {
    hazards: workshopHazards,
    id: "workshop",
    isAvailable: true,
    missionBriefingText:
      "Inspect the workshop scene for machine guarding, entanglement risks, slips, trip hazards, gas cylinder storage, flammables near hot work, housekeeping, and emergency control access.",
    previewImage: "/scenarios/workshop/workshop-scene.png",
    resultTitle: "Workshop Safety Challenge Result",
    sceneImage: "/scenarios/workshop/workshop-scene.png",
    subtitle: "Machinery guarding, tools, housekeeping, and electrical safety.",
    title: "Workshop",
  },
  {
    hazards: restaurantKitchenHazards,
    id: "restaurant-kitchen",
    isAvailable: true,
    missionBriefingText:
      "Inspect the restaurant kitchen scene for slip risks, sharp tool storage, manual handling, hot-surface controls, fryer safety, open equipment doors, and blocked walkways.",
    previewImage: "/scenarios/restaurant-kitchen/restaurant-kitchen-scene.png",
    resultTitle: "Restaurant Kitchen Safety Challenge Result",
    sceneImage: "/scenarios/restaurant-kitchen/restaurant-kitchen-scene.png",
    subtitle: "Slips, burns, hygiene controls, storage, and emergency readiness.",
    title: "Restaurant Kitchen",
  },
  {
    hazards: [],
    id: "hospital",
    isAvailable: false,
    missionBriefingText: "Hospital inspection module coming soon.",
    previewImage: "/warehouse-scene.jpg",
    resultTitle: "Hospital Safety Challenge Result",
    sceneImage: "/warehouse-scene.jpg",
    subtitle: "Clinical workplace hazards, sharps, waste handling, infection controls, and patient movement.",
    title: "Hospital",
  },
  {
    hazards: [],
    id: "laboratory",
    isAvailable: false,
    missionBriefingText: "Laboratory inspection module coming soon.",
    previewImage: "/warehouse-scene.jpg",
    resultTitle: "Laboratory Safety Challenge Result",
    sceneImage: "/warehouse-scene.jpg",
    subtitle: "Chemical handling, biological samples, ventilation, PPE, spill response, and storage controls.",
    title: "Laboratory",
  },
  {
    hazards: [],
    id: "hotel-housekeeping",
    isAvailable: false,
    missionBriefingText: "Hotel and housekeeping inspection module coming soon.",
    previewImage: "/warehouse-scene.jpg",
    resultTitle: "Hotel / Housekeeping Safety Challenge Result",
    sceneImage: "/warehouse-scene.jpg",
    subtitle: "Cleaning chemicals, linen carts, slips, manual handling, and room-service safety hazards.",
    title: "Hotel / Housekeeping",
  },
  {
    hazards: [],
    id: "retail-store",
    isAvailable: false,
    missionBriefingText: "Retail store inspection module coming soon.",
    previewImage: "/warehouse-scene.jpg",
    resultTitle: "Retail Store Safety Challenge Result",
    sceneImage: "/warehouse-scene.jpg",
    subtitle: "Stockroom hazards, blocked aisles, ladder use, manual handling, and customer-area risks.",
    title: "Retail Store",
  },
  {
    hazards: [],
    id: "school-education",
    isAvailable: false,
    missionBriefingText: "School and education facility inspection module coming soon.",
    previewImage: "/warehouse-scene.jpg",
    resultTitle: "School / Education Facility Safety Challenge Result",
    sceneImage: "/warehouse-scene.jpg",
    subtitle: "Classroom, laboratory, evacuation, electrical, slip, and playground safety hazards.",
    title: "School / Education",
  },
  {
    hazards: [],
    id: "automotive-garage",
    isAvailable: false,
    missionBriefingText: "Automotive garage inspection module coming soon.",
    previewImage: "/warehouse-scene.jpg",
    resultTitle: "Automotive Garage Safety Challenge Result",
    sceneImage: "/warehouse-scene.jpg",
    subtitle: "Vehicle lifts, oils, compressed air, welding, tools, and workshop traffic hazards.",
    title: "Automotive Garage",
  },
  {
    hazards: [],
    id: "chemical-storage",
    isAvailable: false,
    missionBriefingText: "Chemical storage room inspection module coming soon.",
    previewImage: "/warehouse-scene.jpg",
    resultTitle: "Chemical Storage Room Safety Challenge Result",
    sceneImage: "/warehouse-scene.jpg",
    subtitle: "Chemical compatibility, labeling, leaks, ventilation, spill controls, and emergency readiness.",
    title: "Chemical Storage",
  },
  {
    hazards: [],
    id: "loading-dock",
    isAvailable: false,
    missionBriefingText: "Loading dock inspection module coming soon.",
    previewImage: "/warehouse-scene.jpg",
    resultTitle: "Loading Dock Safety Challenge Result",
    sceneImage: "/warehouse-scene.jpg",
    subtitle: "Truck movement, dock edges, pallets, pedestrian routes, loading zones, and forklift interface hazards.",
    title: "Loading Dock",
  },
];

const availableScenarios = scenarios.filter((scenario) => scenario.isAvailable);

export default function Home() {
  const [phase, setPhase] = useState<GamePhase>("home");
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyId>("normal");
  const [selectedScenarioId, setSelectedScenarioId] = useState<ScenarioId>("warehouse");
  const [playerName, setPlayerName] = useState("");
  const [playerSurname, setPlayerSurname] = useState("");
  const [playerValidationMessage, setPlayerValidationMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState(difficulties.normal.seconds);
  const [score, setScore] = useState(0);
  const [foundHazards, setFoundHazards] = useState<string[]>([]);
  const [wrongClicks, setWrongClicks] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [message, setMessage] = useState("Find the hazards before time runs out.");
  const [pendingConfirmation, setPendingConfirmation] = useState<ConfirmationAction | null>(null);
  const [leaderboardResults, setLeaderboardResults] = useState<LocalResult[]>([]);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [activeRunId, setActiveRunId] = useState(0);
  const [resultRecordMessage, setResultRecordMessage] = useState("");
  const savedRunIdRef = useRef(0);

  const foundCount = foundHazards.length;
  const selectedScenario =
    scenarios.find((scenario) => scenario.id === selectedScenarioId && scenario.isAvailable) ?? availableScenarios[0]!;
  useEffect(() => {
    if (phase !== "playing") {
      return;
    }

    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          playFeedbackSound("complete", soundEnabled);
          setPhase("results");
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase, soundEnabled]);

  const difficulty = difficulties[selectedDifficulty];
  const playerFullName = `${playerName.trim()} ${playerSurname.trim()}`.trim();
  const result = useMemo(
    () => getResult(getScorePercentage(score, timeLeft, difficulty, selectedScenario.hazards.length)),
    [difficulty, score, selectedScenario.hazards.length, timeLeft],
  );
  const targetToBeat = useMemo(
    () => getBestResult(leaderboardResults, selectedScenario.id, difficulty.label),
    [difficulty.label, leaderboardResults, selectedScenario.id],
  );

  useEffect(() => {
    const loadTimer = window.setTimeout(() => setLeaderboardResults(readLocalResults()), 0);

    return () => window.clearTimeout(loadTimer);
  }, []);

  useEffect(() => {
    if (phase !== "results" || activeRunId === 0 || savedRunIdRef.current === activeRunId) {
      return;
    }

    const totalHazards = selectedScenario.hazards.length;
    const finalScore = getFinalScore(score, timeLeft);
    const maxScore = getMaxTotalScore(difficulty, totalHazards);
    const scorePercentage = getScorePercentage(score, timeLeft, difficulty, totalHazards);
    const previousBest = getBestResult(leaderboardResults, selectedScenario.id, difficulty.label);
    const completedAt = new Date().toISOString();
    const currentResult: LocalResult = {
      completedAt,
      difficulty: difficulty.label,
      finalScore,
      hazardsFound: foundCount,
      maxScore,
      playerName: playerName.trim(),
      playerSurname: playerSurname.trim(),
      rankTitle: result.rank,
      scenarioId: selectedScenario.id,
      scenarioName: selectedScenario.title,
      scorePercentage,
      timeRemaining: timeLeft,
      totalHazards,
      wrongClicks,
    };

    const recordMessage = !previousBest
      ? "First result recorded for this scenario and difficulty."
      : compareResults(currentResult, previousBest) < 0
        ? "New record! You set the best score for this scenario and difficulty."
        : `Top score to beat: ${previousBest.scorePercentage}% by ${formatPlayerName(previousBest)}.`;

    const nextResults = sortResults([currentResult, ...leaderboardResults]).slice(0, MAX_LOCAL_RESULTS);

    savedRunIdRef.current = activeRunId;
    const saveTimer = window.setTimeout(() => {
      setResultRecordMessage(recordMessage);
      writeLocalResults(nextResults);
      setLeaderboardResults(nextResults);
    }, 0);

    return () => window.clearTimeout(saveTimer);
  }, [
    activeRunId,
    difficulty,
    foundCount,
    leaderboardResults,
    phase,
    playerName,
    playerSurname,
    result.rank,
    score,
    selectedScenario,
    timeLeft,
    wrongClicks,
  ]);

  function startGame() {
    const nextRunId = Date.now();

    setActiveRunId(nextRunId);
    savedRunIdRef.current = 0;
    setPhase("playing");
    setTimeLeft(difficulty.seconds);
    setScore(0);
    setFoundHazards([]);
    setWrongClicks(0);
    setHintsUsed(0);
    setFeedback(null);
    setResultRecordMessage("");
    setMessage(`Find all ${selectedScenario.hazards.length} hazards in the ${selectedScenario.title} challenge.`);
  }

  function returnHome() {
    setPhase("home");
    setTimeLeft(difficulty.seconds);
    setScore(0);
    setFoundHazards([]);
    setWrongClicks(0);
    setHintsUsed(0);
    setFeedback(null);
    setPlayerValidationMessage("");
    setMessage("Find the hazards before time runs out.");
  }

  function handleHomeRequest() {
    if (phase === "playing") {
      setPendingConfirmation("home");
      return;
    }

    returnHome();
  }

  function confirmPendingAction() {
    const action = pendingConfirmation;

    setPendingConfirmation(null);

    if (action === "home") {
      returnHome();
      return;
    }

    if (action === "restart") {
      startGame();
    }
  }

  function continueToBriefing() {
    if (!playerName.trim() || !playerSurname.trim()) {
      setPlayerValidationMessage("Please enter your name and surname to continue.");
      return;
    }

    setPlayerValidationMessage("");
    setPhase("briefing");
  }

  function handleHazardClick(hazard: Hazard) {
    if (phase !== "playing" || foundHazards.includes(hazard.id)) {
      return;
    }

    const nextFoundCount = foundHazards.length + 1;

    setFoundHazards((current) => [...current, hazard.id]);
    setScore((current) => current + CORRECT_HAZARD_POINTS);
    setMessage(`${hazard.name}: ${hazard.explanation}`);
    playFeedbackSound("correct", soundEnabled);
    showTemporaryFeedback({ text: `+${CORRECT_HAZARD_POINTS} score`, tone: "success" });

    if (nextFoundCount === selectedScenario.hazards.length) {
      playFeedbackSound("complete", soundEnabled);
      setPhase("results");
    }
  }

  function handleWrongClick() {
    if (phase !== "playing") {
      return;
    }

    setTimeLeft((current) => Math.max(0, current - difficulty.wrongClickPenalty));
    setScore((current) => current - difficulty.wrongClickPenalty);
    setWrongClicks((current) => current + 1);
    playFeedbackSound("wrong", soundEnabled);
    showTemporaryFeedback({
      text: `-${difficulty.wrongClickPenalty} score / -${difficulty.wrongClickPenalty}s`,
      tone: "danger",
    });
    setMessage(
      wrongClicks >= 2
        ? "Inspect carefully — random clicking reduces your score."
        : "No hazard found there. Recheck access routes, storage, chemicals, power, and fire controls.",
    );
  }

  function handleUseHint() {
    if (phase !== "playing") {
      return;
    }

    const hintsRemaining = difficulty.hints - hintsUsed;
    const nextHazard = selectedScenario.hazards.find((hazard) => !foundHazards.includes(hazard.id));

    if (hintsRemaining <= 0) {
      setMessage("No hints remaining for this difficulty.");
      return;
    }

    if (!nextHazard) {
      setMessage("All hazards have already been found.");
      return;
    }

    setHintsUsed((current) => current + 1);
    setScore((current) => current - HINT_PENALTY);
    playFeedbackSound("hint", soundEnabled);
    showTemporaryFeedback({ text: `Hint used: -${HINT_PENALTY} score`, tone: "info" });
    setMessage(`Hint: ${nextHazard.hint}`);
  }

  function showTemporaryFeedback(nextFeedback: Feedback) {
    setFeedback(nextFeedback);
    window.setTimeout(() => setFeedback(null), 1600);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#06111F] text-[#DFF6FF]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 py-3 sm:px-6 sm:py-5 lg:px-8">
        <Header onHome={handleHomeRequest} onLeaderboard={() => setIsLeaderboardOpen(true)} />

        {phase === "home" && (
          <HomeScreen
            playerName={playerName}
            playerSurname={playerSurname}
            selectedDifficulty={selectedDifficulty}
            selectedScenarioId={selectedScenario.id}
            onDifficultyChange={setSelectedDifficulty}
            onPlayerNameChange={setPlayerName}
            onPlayerSurnameChange={setPlayerSurname}
            onScenarioChange={setSelectedScenarioId}
            onStart={continueToBriefing}
            targetToBeat={targetToBeat}
            validationMessage={playerValidationMessage}
          />
        )}

        {phase === "briefing" && (
          <MissionBriefing
            playerFullName={playerFullName}
            scenario={selectedScenario}
            selectedDifficulty={difficulty}
            onBack={() => setPhase("home")}
            onBegin={startGame}
          />
        )}

        {phase === "playing" && (
          <GameScreen
            foundHazards={foundHazards}
            feedback={feedback}
            message={message}
            scenario={selectedScenario}
            hintsRemaining={difficulty.hints - hintsUsed}
            onHazardClick={handleHazardClick}
            onSoundToggle={() => setSoundEnabled((current) => !current)}
            onRestartRequest={() => setPendingConfirmation("restart")}
            onUseHint={handleUseHint}
            onWrongClick={handleWrongClick}
            score={score}
            soundEnabled={soundEnabled}
            timeLeft={timeLeft}
          />
        )}

        {phase === "results" && (
          <ResultsScreen
            foundCount={foundCount}
            foundHazards={foundHazards}
            playerFullName={playerFullName}
            recommendation={result.recommendation}
            rank={result.rank}
            score={score}
            selectedDifficulty={difficulty}
            scenario={selectedScenario}
            hintsUsed={hintsUsed}
            timeLeft={timeLeft}
            wrongClicks={wrongClicks}
            recordMessage={resultRecordMessage}
            onPlayAgain={startGame}
          />
        )}

        {pendingConfirmation && (
          <ConfirmationModal
            confirmLabel={pendingConfirmation === "home" ? "Return Home" : "Restart"}
            message={
              pendingConfirmation === "home"
                ? "Return to homepage? Your current progress will be lost."
                : "Restart challenge? Your current progress will be lost."
            }
            onCancel={() => setPendingConfirmation(null)}
            onConfirm={confirmPendingAction}
          />
        )}

        {isLeaderboardOpen && (
          <LeaderboardModal results={leaderboardResults} onClose={() => setIsLeaderboardOpen(false)} />
        )}
      </div>
    </main>
  );
}

function Header({ onHome, onLeaderboard }: { onHome: () => void; onLeaderboard: () => void }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#6FD3FF]/15 pb-2 sm:gap-3 sm:pb-3">
      <button
        aria-label="Return to LABORIA Safety Rush home"
        className="-m-2 flex min-w-0 items-center gap-2 rounded-xl p-2 text-left transition hover:bg-[#6FD3FF]/8 focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/20 sm:gap-3"
        onClick={onHome}
        type="button"
      >
        <FullLogo />
        <div className="border-l border-[#6FD3FF]/20 pl-2 sm:pl-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6FD3FF] sm:text-xs sm:tracking-[0.24em]">
            LABORIA
          </p>
          <h1 className="text-xl font-black tracking-tight text-[#DFF6FF] sm:text-3xl">Safety Rush</h1>
        </div>
      </button>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <a
          className="min-h-10 rounded-lg border border-[#6FD3FF]/30 bg-[#06111F]/60 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#DFF6FF] transition hover:bg-[#0A3D78]/55 focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/20 sm:px-4"
          href="mailto:Laboriahse@gmail.com?subject=LABORIA%20Safety%20Rush%20Inquiry&body=Hello%20LABORIA%20team%2C%0A%0AI%20am%20interested%20in%20LABORIA%20Safety%20Rush.%0A%0APlease%20contact%20me%20with%20more%20information."
        >
          Contact LABORIA
        </a>
        <button
          className="min-h-10 rounded-lg border border-[#6FD3FF]/30 bg-[#0A3D78]/30 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#DFF6FF] transition hover:bg-[#0A3D78]/55 focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/20 sm:px-4"
          onClick={onLeaderboard}
          type="button"
        >
          Leaderboard
        </button>
        <div className="hidden rounded-full border border-[#6FD3FF]/35 bg-[#0A3D78]/35 px-4 py-2 text-sm font-semibold text-[#DFF6FF] shadow-lg shadow-[#03101d]/30 sm:block">
          Interactive HS Training
        </div>
      </div>
    </header>
  );
}

function ConfirmationModal({
  confirmLabel,
  message,
  onCancel,
  onConfirm,
}: {
  confirmLabel: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-[#06111F]/78 px-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-xl border border-[#6FD3FF]/25 bg-[#0B1D33] p-5 text-left shadow-[0_0_54px_rgba(111,211,255,0.16)] ring-1 ring-[#DFF6FF]/8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6FD3FF]">Confirm Action</p>
        <h2 className="mt-3 text-2xl font-black text-[#DFF6FF]">Progress will reset</h2>
        <p className="mt-3 text-sm leading-6 text-[#9FC3DD]">{message}</p>
        <div className="mt-5 flex flex-col justify-end gap-2 sm:flex-row">
          <button
            className="rounded-lg border border-[#6FD3FF]/35 bg-[#06111F]/60 px-5 py-2.5 text-sm font-black text-[#DFF6FF] transition hover:bg-[#0A3D78]/45 focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/20"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-[#6FD3FF] px-5 py-2.5 text-sm font-black text-[#06111F] transition hover:bg-[#DFF6FF] focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/30"
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function LeaderboardModal({ onClose, results }: { onClose: () => void; results: LocalResult[] }) {
  const [scenarioFilter, setScenarioFilter] = useState<ScenarioId | "all">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyId | "all">("all");
  const filteredResults = sortResults(
    results.filter((result) => {
      const matchesScenario = scenarioFilter === "all" || result.scenarioId === scenarioFilter;
      const matchesDifficulty =
        difficultyFilter === "all" || result.difficulty === difficulties[difficultyFilter].label;

      return matchesScenario && matchesDifficulty;
    }),
  ).slice(0, 10);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-[#06111F]/80 px-3 py-5 backdrop-blur-sm sm:px-4"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-xl border border-[#6FD3FF]/25 bg-[#0B1D33] text-left shadow-[0_0_54px_rgba(111,211,255,0.16)] ring-1 ring-[#DFF6FF]/8">
        <div className="flex flex-col gap-3 border-b border-[#6FD3FF]/15 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6FD3FF]">Local Records</p>
            <h2 className="mt-1 text-2xl font-black text-[#DFF6FF]">LABORIA Safety Rush Leaderboard</h2>
          </div>
          <button
            className="min-h-10 rounded-lg border border-[#6FD3FF]/35 bg-[#06111F]/60 px-4 py-2 text-sm font-black text-[#DFF6FF] transition hover:bg-[#0A3D78]/45 focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/20"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="max-h-[calc(92vh-92px)] overflow-y-auto p-4 [scrollbar-color:rgba(111,211,255,0.38)_rgba(11,29,51,0.55)] [scrollbar-width:thin] sm:p-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#6FD3FF]/35 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-[#0B1D33]/55">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9FC3DD]">Scenario</span>
              <select
                className="mt-1 min-h-11 w-full rounded-lg border border-[#6FD3FF]/20 bg-[#06111F]/80 px-3 py-2 text-sm font-bold text-[#DFF6FF] outline-none focus:border-[#6FD3FF]/55 focus:ring-4 focus:ring-[#6FD3FF]/15"
                onChange={(event) => setScenarioFilter(event.target.value as ScenarioId | "all")}
                value={scenarioFilter}
              >
                <option value="all">All scenarios</option>
                {availableScenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9FC3DD]">Difficulty</span>
              <select
                className="mt-1 min-h-11 w-full rounded-lg border border-[#6FD3FF]/20 bg-[#06111F]/80 px-3 py-2 text-sm font-bold text-[#DFF6FF] outline-none focus:border-[#6FD3FF]/55 focus:ring-4 focus:ring-[#6FD3FF]/15"
                onChange={(event) => setDifficultyFilter(event.target.value as DifficultyId | "all")}
                value={difficultyFilter}
              >
                <option value="all">All difficulties</option>
                {difficultyOptions.map(([difficultyId, option]) => (
                  <option key={difficultyId} value={difficultyId}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filteredResults.length === 0 ? (
            <p className="mt-5 rounded-lg border border-[#6FD3FF]/15 bg-[#06111F]/55 p-4 text-center text-sm font-bold text-[#9FC3DD]">
              No results yet. Complete a challenge to set the first record.
            </p>
          ) : (
            <>
              <div className="mt-5 hidden overflow-hidden rounded-lg border border-[#6FD3FF]/15 lg:block">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-[#06111F]/70 text-left text-[10px] uppercase tracking-[0.16em] text-[#9FC3DD]">
                    <tr>
                      <th className="px-3 py-3">#</th>
                      <th className="px-3 py-3">Player</th>
                      <th className="px-3 py-3">Scenario</th>
                      <th className="px-3 py-3">Difficulty</th>
                      <th className="px-3 py-3">Rank</th>
                      <th className="px-3 py-3">Score</th>
                      <th className="px-3 py-3">Time</th>
                      <th className="px-3 py-3">Hazards</th>
                      <th className="px-3 py-3">Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((result, index) => (
                      <tr className="border-t border-[#6FD3FF]/10 text-[#DFF6FF]" key={getResultKey(result, index)}>
                        <td className="px-3 py-3 font-black text-[#6FD3FF]">{index + 1}</td>
                        <td className="px-3 py-3 font-bold">{formatPlayerName(result)}</td>
                        <td className="px-3 py-3">{result.scenarioName}</td>
                        <td className="px-3 py-3">{result.difficulty}</td>
                        <td className="px-3 py-3">{result.rankTitle}</td>
                        <td className="px-3 py-3 font-black text-[#6FD3FF]">
                          {result.scorePercentage}% · {result.finalScore}/{result.maxScore}
                        </td>
                        <td className="px-3 py-3">{result.timeRemaining}s</td>
                        <td className="px-3 py-3">
                          {result.hazardsFound}/{result.totalHazards}
                        </td>
                        <td className="px-3 py-3 text-[#9FC3DD]">{formatResultDate(result.completedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 grid gap-3 lg:hidden">
                {filteredResults.map((result, index) => (
                  <article
                    className="rounded-lg border border-[#6FD3FF]/15 bg-[#06111F]/55 p-3"
                    key={getResultKey(result, index)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6FD3FF]">
                          #{index + 1} · {result.rankTitle}
                        </p>
                        <h3 className="mt-1 text-lg font-black text-[#DFF6FF]">{formatPlayerName(result)}</h3>
                      </div>
                      <p className="text-2xl font-black text-[#6FD3FF]">{result.scorePercentage}%</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#DFF6FF]">
                      <p>
                        <span className="text-[#9FC3DD]">Scenario:</span> {result.scenarioName}
                      </p>
                      <p>
                        <span className="text-[#9FC3DD]">Difficulty:</span> {result.difficulty}
                      </p>
                      <p>
                        <span className="text-[#9FC3DD]">Score:</span> {result.finalScore}/{result.maxScore}
                      </p>
                      <p>
                        <span className="text-[#9FC3DD]">Time:</span> {result.timeRemaining}s
                      </p>
                      <p>
                        <span className="text-[#9FC3DD]">Hazards:</span> {result.hazardsFound}/{result.totalHazards}
                      </p>
                      <p>
                        <span className="text-[#9FC3DD]">Completed:</span> {formatResultDate(result.completedAt)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HomeScreen({
  onDifficultyChange,
  onPlayerNameChange,
  onPlayerSurnameChange,
  onScenarioChange,
  onStart,
  playerName,
  playerSurname,
  selectedDifficulty,
  selectedScenarioId,
  targetToBeat,
  validationMessage,
}: {
  onDifficultyChange: (difficulty: DifficultyId) => void;
  onPlayerNameChange: (name: string) => void;
  onPlayerSurnameChange: (surname: string) => void;
  onScenarioChange: (scenario: ScenarioId) => void;
  onStart: () => void;
  playerName: string;
  playerSurname: string;
  selectedDifficulty: DifficultyId;
  selectedScenarioId: ScenarioId;
  targetToBeat: LocalResult | null;
  validationMessage: string;
}) {
  const selectedSettings = difficulties[selectedDifficulty];
  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[0]!;
  const [displayedScenario, setDisplayedScenario] = useState(selectedScenario);
  const [isScenarioTransitioning, setIsScenarioTransitioning] = useState(false);
  const scenarioTransitionClass = isScenarioTransitioning
    ? "opacity-80 translate-y-0.5"
    : "opacity-100 translate-y-0";

  useEffect(() => {
    if (displayedScenario.id === selectedScenario.id) {
      return;
    }

    const fadeOutTimer = window.setTimeout(() => setIsScenarioTransitioning(true), 0);
    const swapTimer = window.setTimeout(() => setDisplayedScenario(selectedScenario), 150);
    const fadeInTimer = window.setTimeout(() => setIsScenarioTransitioning(false), 190);

    return () => {
      window.clearTimeout(fadeOutTimer);
      window.clearTimeout(swapTimer);
      window.clearTimeout(fadeInTimer);
    };
  }, [displayedScenario.id, selectedScenario]);

  return (
    <section className="relative flex flex-1 items-stretch overflow-visible py-2 sm:py-2 lg:h-[calc(100vh-136px)] lg:min-h-[540px] lg:max-h-[630px] lg:overflow-hidden lg:py-1.5">
      <div className="absolute inset-0 -z-10">
        <Image
          alt=""
          className="h-full w-full object-cover opacity-[0.34]"
          fill
          priority
          sizes="100vw"
          src={displayedScenario.previewImage}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(111,211,255,0.16),transparent_34%),linear-gradient(180deg,rgba(6,17,31,0.42),#06111F_88%)]" />
      </div>

      <div className="mx-auto grid w-full max-w-7xl gap-3 lg:h-full lg:grid-rows-[auto_minmax(0,1fr)]">
        <div className="mx-auto max-w-5xl text-center">
          <div
            className={`inline-flex rounded-full border border-[#6FD3FF]/30 bg-[#06111F]/55 px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6FD3FF] shadow-lg shadow-[#03101d]/30 transition-all duration-300 ease-out motion-reduce:translate-y-0 motion-reduce:transition-none ${scenarioTransitionClass}`}
          >
            {displayedScenario.title} Safety Challenge
          </div>
          <h2 className="mx-auto mt-1.5 max-w-4xl text-[30px] font-black leading-[1.04] text-[#DFF6FF] sm:text-[42px] sm:leading-[1.02] lg:text-[46px]">
            Spot hazards before the clock runs out.
          </h2>
          <p className="mx-auto mt-1.5 max-w-2xl text-[13px] leading-5 text-[#DFF6FF]/76 sm:text-sm">
            Choose a scenario, set the challenge level, and test your visual HS inspection discipline in a timed safety
            rush.
          </p>
        </div>

        <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_410px] lg:items-stretch xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="min-h-[220px] overflow-hidden rounded-2xl border border-[#6FD3FF]/18 bg-[#0B1D33]/55 p-2 shadow-2xl shadow-[#03101d]/50 backdrop-blur-md sm:min-h-[260px] lg:min-h-0">
            <div className="relative h-full overflow-hidden rounded-xl">
              <div
                className={`h-full transition-all duration-300 ease-out motion-reduce:translate-y-0 motion-reduce:transition-none ${scenarioTransitionClass}`}
              >
                <MiniWarehouse scenario={displayedScenario} />
              </div>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_68%,rgba(6,17,31,0.34))]" />
              <div
                className={`absolute inset-x-3 bottom-3 rounded-lg border border-[#6FD3FF]/22 bg-[#06111F]/70 px-3 py-2 backdrop-blur-md transition-all duration-300 ease-out motion-reduce:translate-y-0 motion-reduce:transition-none sm:inset-x-auto sm:max-w-sm ${scenarioTransitionClass}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6FD3FF]">Selected Scenario</p>
                <p className="text-lg font-black text-[#DFF6FF]">{displayedScenario.title}</p>
                <p className="mt-0.5 max-w-sm text-xs leading-5 text-[#9FC3DD]">{displayedScenario.subtitle}</p>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col self-end overflow-hidden rounded-2xl border border-[#6FD3FF]/24 bg-[#06111F]/80 p-2.5 text-left shadow-[0_0_42px_rgba(111,211,255,0.13)] backdrop-blur-xl sm:p-3 lg:max-h-full lg:p-2.5 xl:p-3">
            <div className="flex flex-shrink-0 items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6FD3FF]">Start Inspection</p>
                <h3 className="mt-0.5 text-lg font-black text-[#DFF6FF] sm:text-xl">Mission setup</h3>
              </div>
              <p className="text-right text-xs font-semibold text-[#9FC3DD]">
                {selectedSettings.seconds}s · -{selectedSettings.wrongClickPenalty} penalty
              </p>
            </div>

            <div className="mt-1.5 min-h-0 flex-shrink overflow-hidden">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9FC3DD]">Scenario</p>
              <div className="mt-1 grid max-h-[112px] grid-cols-2 gap-1.5 overflow-y-auto overscroll-contain pr-1 [scrollbar-color:rgba(111,211,255,0.38)_rgba(11,29,51,0.55)] [scrollbar-width:thin] sm:grid-cols-3 lg:max-h-[82px] xl:max-h-[98px] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#6FD3FF]/35 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-[#0B1D33]/55">
                {scenarios.map((scenario) => {
                  const isSelected = selectedScenarioId === scenario.id;

                  return (
                    <button
                      className={`rounded-lg border px-2 py-1.5 text-left transition focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/25 lg:py-1 ${
                        isSelected
                          ? "border-[#6FD3FF]/65 bg-[#0A3D78]/58 text-[#DFF6FF]"
                          : "border-[#6FD3FF]/14 bg-[#0B1D33]/58 text-[#9FC3DD] hover:border-[#6FD3FF]/34 hover:bg-[#0A3D78]/25"
                      } ${scenario.isAvailable ? "" : "cursor-not-allowed opacity-38"}`}
                      disabled={!scenario.isAvailable}
                      key={scenario.id}
                      onClick={() => onScenarioChange(scenario.id)}
                      title={scenario.subtitle}
                      type="button"
                    >
                      <span className="block truncate text-xs font-black text-[#DFF6FF]">{scenario.title}</span>
                      <span
                        className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${
                          scenario.isAvailable ? "bg-[#58D68D]/14 text-[#CFFFE1]" : "bg-[#9FC3DD]/10 text-[#9FC3DD]"
                        }`}
                      >
                        {scenario.isAvailable ? "Available" : "Coming Soon"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-1.5 flex-shrink-0">
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9FC3DD]">Name</span>
                  <input
                    className="mt-0.5 min-h-11 w-full rounded-lg border border-[#6FD3FF]/20 bg-[#0B1D33]/72 px-3 py-2 text-sm font-semibold text-[#DFF6FF] outline-none transition placeholder:text-[#9FC3DD]/55 focus:border-[#6FD3FF]/55 focus:ring-4 focus:ring-[#6FD3FF]/15 sm:min-h-0 lg:py-1"
                    onChange={(event) => onPlayerNameChange(event.target.value)}
                    placeholder="Enter name"
                    type="text"
                    value={playerName}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9FC3DD]">Surname</span>
                  <input
                    className="mt-0.5 min-h-11 w-full rounded-lg border border-[#6FD3FF]/20 bg-[#0B1D33]/72 px-3 py-2 text-sm font-semibold text-[#DFF6FF] outline-none transition placeholder:text-[#9FC3DD]/55 focus:border-[#6FD3FF]/55 focus:ring-4 focus:ring-[#6FD3FF]/15 sm:min-h-0 lg:py-1"
                    onChange={(event) => onPlayerSurnameChange(event.target.value)}
                    placeholder="Enter surname"
                    type="text"
                    value={playerSurname}
                  />
                </label>
              </div>

              <div className="mt-1.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9FC3DD]">Difficulty</p>
                <div className="mt-1 grid grid-cols-3 gap-1.5">
                  {difficultyOptions.map(([difficultyId, option]) => {
                    const isSelected = selectedDifficulty === difficultyId;

                    return (
                      <button
                        className={`min-h-11 rounded-lg border px-2 py-1.5 text-center transition focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/25 sm:min-h-0 lg:py-1 ${
                          isSelected
                            ? "border-[#6FD3FF]/65 bg-[#0A3D78]/58 text-[#DFF6FF]"
                            : "border-[#6FD3FF]/14 bg-[#0B1D33]/58 text-[#9FC3DD] hover:border-[#6FD3FF]/34 hover:bg-[#0A3D78]/25"
                        }`}
                        key={difficultyId}
                        onClick={() => onDifficultyChange(difficultyId)}
                        type="button"
                      >
                        <span className="block text-xs font-black text-[#DFF6FF]">{option.label}</span>
                        <span className="block text-[10px] leading-4">{option.seconds}s</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-1.5 min-h-8">
                {validationMessage && (
                  <p className="rounded-lg border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 px-2 py-1 text-xs font-bold leading-5 text-[#FFD6D6]">
                    {validationMessage}
                  </p>
                )}
              </div>

              <p className="mt-1 rounded-lg border border-[#6FD3FF]/18 bg-[#0B1D33]/55 px-2 py-1.5 text-xs font-bold text-[#DFF6FF]">
                {targetToBeat
                  ? `Target to beat: ${targetToBeat.scorePercentage}% by ${formatPlayerName(targetToBeat)}`
                  : "No record yet — be the first to set one."}
              </p>

              <button
                className="mt-1.5 min-h-11 w-full rounded-lg bg-[#6FD3FF] px-6 py-2.5 text-sm font-black text-[#06111F] shadow-[0_18px_60px_rgba(111,211,255,0.2)] transition hover:bg-[#DFF6FF] focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/35 sm:min-h-0 lg:py-2"
                onClick={onStart}
              >
                Start Inspection
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FullLogo() {
  return (
    <div className="shrink-0 rounded-lg border border-[#6FD3FF]/25 bg-[linear-gradient(135deg,#0B1D33_0%,#0A3D78_100%)] p-1 shadow-lg shadow-[#03101d]/40 ring-1 ring-[#DFF6FF]/10 sm:p-1.5">
      <div className="rounded-md border border-[#6FD3FF]/15 bg-[#DFF6FF]/90 p-0.5 shadow-inner shadow-[#0A3D78]/20">
        <Image
          alt="LABORIA logo"
          className="h-auto w-20 rounded sm:w-32"
          height={864}
          priority
          src="/laboria-logo.png"
          width={1536}
        />
      </div>
    </div>
  );
}

function MissionBriefing({
  onBack,
  onBegin,
  playerFullName,
  scenario,
  selectedDifficulty,
}: {
  onBack: () => void;
  onBegin: () => void;
  playerFullName: string;
  scenario: Scenario;
  selectedDifficulty: (typeof difficulties)[DifficultyId];
}) {
  const rules = [
    { label: "Time limit", value: `${selectedDifficulty.seconds} seconds` },
    { label: "Correct hazard", value: `+${CORRECT_HAZARD_POINTS} score` },
    {
      label: "Wrong click penalty",
      value: `-${selectedDifficulty.wrongClickPenalty} score / -${selectedDifficulty.wrongClickPenalty}s`,
    },
    { label: "Hints available", value: selectedDifficulty.hints.toString() },
    { label: "Inspection standard", value: "No hover clues — inspect visually" },
  ];

  return (
    <section className="grid flex-1 place-items-center py-4 sm:py-8">
      <div className="w-full max-w-5xl rounded-xl border border-[#6FD3FF]/20 bg-[#0B1D33]/90 p-4 shadow-2xl shadow-[#03101d]/45 ring-1 ring-[#6FD3FF]/10 sm:p-7">
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#6FD3FF]">Mission Briefing</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-[#DFF6FF] sm:text-5xl">
              {scenario.title} Inspection Briefing
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#9FC3DD] sm:mt-4 sm:text-base sm:leading-7">
              Your task is to identify all workplace hazards before the timer runs out.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <div className="inline-flex rounded-full border border-[#6FD3FF]/30 bg-[#0A3D78]/35 px-3 py-2 text-xs font-black text-[#DFF6FF] sm:px-4 sm:text-sm">
                Scenario: {scenario.title}
              </div>
              <div className="inline-flex rounded-full border border-[#6FD3FF]/30 bg-[#0A3D78]/35 px-3 py-2 text-xs font-black text-[#DFF6FF] sm:px-4 sm:text-sm">
                Difficulty: {selectedDifficulty.label}
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-[#6FD3FF]/18 bg-[#06111F]/55 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9FC3DD]">Inspector</p>
              <p className="mt-1 text-lg font-black text-[#DFF6FF]">{playerFullName}</p>
            </div>
            <p className="mt-4 rounded-lg border border-[#6FD3FF]/15 bg-[#06111F]/55 p-3 text-sm leading-6 text-[#DFF6FF] sm:mt-5 sm:p-4">
              {scenario.missionBriefingText}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {rules.map((rule) => (
              <article
                className="rounded-lg border border-[#6FD3FF]/15 bg-[#06111F]/55 p-3 shadow-lg shadow-[#03101d]/20 sm:p-4"
                key={rule.label}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9FC3DD]">{rule.label}</p>
                <p className="mt-2 text-lg font-black text-[#6FD3FF]">{rule.value}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col justify-end gap-3 sm:mt-7 sm:flex-row">
          <button
            className="min-h-11 rounded-lg border border-[#6FD3FF]/40 bg-[#0A3D78]/30 px-6 py-3 font-black text-[#DFF6FF] transition hover:bg-[#0A3D78]/55 focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/25 sm:min-h-0"
            onClick={onBack}
            type="button"
          >
            Back to Difficulty
          </button>
          <button
            className="min-h-11 rounded-lg bg-[#6FD3FF] px-6 py-3 font-black text-[#06111F] shadow-[0_18px_60px_rgba(111,211,255,0.18)] transition hover:bg-[#DFF6FF] focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/35 sm:min-h-0"
            onClick={onBegin}
            type="button"
          >
            Begin Inspection
          </button>
        </div>
      </div>
    </section>
  );
}

function GameScreen({
  feedback,
  foundHazards,
  hintsRemaining,
  message,
  onHazardClick,
  onRestartRequest,
  onSoundToggle,
  onUseHint,
  onWrongClick,
  scenario,
  score,
  soundEnabled,
  timeLeft,
}: {
  feedback: Feedback | null;
  foundHazards: string[];
  hintsRemaining: number;
  message: string;
  onHazardClick: (hazard: Hazard) => void;
  onRestartRequest: () => void;
  onSoundToggle: () => void;
  onUseHint: () => void;
  onWrongClick: () => void;
  scenario: Scenario;
  score: number;
  soundEnabled: boolean;
  timeLeft: number;
}) {
  const isHintMessage = message.startsWith("Hint:");
  const displayedMessage = isHintMessage ? message.replace(/^Hint:\s*/, "") : message;
  const isTimerUrgent = timeLeft <= 10;

  return (
    <section className="grid flex-1 gap-4 py-4 sm:gap-5 sm:py-5 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3 sm:mb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6FD3FF] sm:text-sm sm:tracking-[0.18em]">
              {scenario.title} Safety Challenge
            </p>
            <h2 className="text-xl font-black text-[#DFF6FF] sm:text-2xl">
              Find all {scenario.hazards.length} clickable hazards
            </h2>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button
              className="min-h-11 flex-1 rounded-lg border border-[#6FD3FF]/20 bg-[#06111F]/60 px-3 py-2.5 text-center text-xs font-black text-[#DFF6FF] transition hover:bg-[#0A3D78]/45 focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/25 sm:flex-none sm:px-4 sm:py-3"
              onClick={onRestartRequest}
              type="button"
            >
              Restart Challenge
            </button>
            <button
              className="min-h-11 flex-1 rounded-lg border border-[#6FD3FF]/20 bg-[#06111F]/60 px-3 py-2.5 text-center text-xs font-black text-[#DFF6FF] transition hover:bg-[#0A3D78]/45 focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/25 sm:flex-none sm:px-4 sm:py-3"
              onClick={onSoundToggle}
              type="button"
            >
              {soundEnabled ? "Sound On" : "Sound Off"}
            </button>
            <Stat label="Time" value={`${timeLeft}s`} tone={isTimerUrgent ? "danger" : "normal"} />
            <Stat label="Score" value={score.toString()} tone="accent" />
            <Stat label="Hints" value={hintsRemaining.toString()} tone="normal" />
          </div>
        </div>
        <WarehouseScene
          feedback={feedback}
          foundHazards={foundHazards}
          scenario={scenario}
          onHazardClick={onHazardClick}
          onWrongClick={onWrongClick}
        />
      </div>

      <aside className="rounded-xl border border-[#6FD3FF]/15 bg-[#0B1D33]/85 p-4 shadow-xl shadow-[#03101d]/30 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-[#DFF6FF]">Inspection Notes</h3>
          <span className="rounded-full border border-[#6FD3FF]/25 bg-[#0A3D78]/45 px-3 py-1 text-sm font-black text-[#DFF6FF]">
            {foundHazards.length}/8
          </span>
        </div>
        <div
          className={`mt-4 min-h-24 rounded-lg border p-3 text-sm leading-6 sm:min-h-28 sm:p-4 ${
            isHintMessage
              ? "border-[#58D68D]/35 bg-[#58D68D]/10 text-[#CFFFE1]"
              : "border-[#6FD3FF]/18 bg-[#06111F]/70 text-[#DFF6FF]"
          }`}
        >
          {isHintMessage && (
            <p className="mb-1 text-xs font-black uppercase tracking-[0.2em] text-[#58D68D]">Hint</p>
          )}
          <p className={isHintMessage ? "font-black" : ""}>{displayedMessage}</p>
        </div>
        <button
          className="mt-3 min-h-11 w-full rounded-lg border border-[#6FD3FF]/40 bg-[#0A3D78]/35 px-4 py-2.5 text-sm font-black text-[#DFF6FF] transition hover:bg-[#0A3D78]/60 focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/25 disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-0"
          disabled={hintsRemaining <= 0 || foundHazards.length === scenario.hazards.length}
          onClick={onUseHint}
          type="button"
        >
          Use Hint ({hintsRemaining} left)
        </button>
        <div className="mt-4 grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 text-xs [scrollbar-color:rgba(111,211,255,0.38)_rgba(11,29,51,0.55)] [scrollbar-width:thin] sm:mt-5 sm:grid-cols-2 lg:max-h-none lg:grid-cols-1 lg:overflow-visible lg:pr-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#6FD3FF]/35 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-[#0B1D33]/55">
          {scenario.hazards.map((hazard, index) => (
            <div
              className={`rounded-lg border px-3 py-2 font-semibold ${
                foundHazards.includes(hazard.id)
                  ? "border-[#6FD3FF]/45 bg-[#0A3D78]/45 text-[#DFF6FF]"
                  : "border-[#6FD3FF]/10 bg-[#06111F]/45 text-[#9FC3DD]"
              }`}
              key={hazard.id}
            >
              {foundHazards.includes(hazard.id) ||
              hazard.id === "construction-rebar" ||
              hazard.id === "kitchen-pan-handle"
                ? hazard.name
                : `Inspection point ${index + 1}`}
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

function WarehouseScene({
  feedback,
  foundHazards,
  scenario,
  onHazardClick,
  onWrongClick,
}: {
  feedback: Feedback | null;
  foundHazards: string[];
  scenario: Scenario;
  onHazardClick: (hazard: Hazard) => void;
  onWrongClick: () => void;
}) {
  return (
    <div
      aria-label="Warehouse scene"
      className="relative block aspect-[1672/941] w-full cursor-default overflow-hidden rounded-lg border border-[#6FD3FF]/15 bg-[#0B1D33] text-left shadow-2xl shadow-[#03101d]/40 sm:rounded-xl"
      onClick={onWrongClick}
      role="application"
    >
      <SceneImage
        alt={`${scenario.title} safety challenge scene`}
        priority
        src={scenario.sceneImage}
        sizes="(min-width: 1024px) calc(100vw - 380px), 100vw"
      />
      <style>{`
        @keyframes resolvedFade {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
      {feedback && <FeedbackNotice feedback={feedback} />}

      {scenario.hazards.map((hazard) => {
        const isFound = foundHazards.includes(hazard.id);

        return (
          <button
            aria-label={hazard.name}
            className={`absolute z-20 cursor-default rounded-xl border-2 ${
              isFound
                ? "border-transparent bg-transparent"
                : SHOW_HOTSPOT_DEBUG
                  ? "border-[#6FD3FF]/65 bg-[#6FD3FF]/12"
                  : "border-transparent bg-transparent"
            }`}
            key={hazard.id}
            onClick={(event) => {
              event.stopPropagation();
              onHazardClick(hazard);
            }}
            style={{
              height: `${hazard.hotspot.height}%`,
              left: `${hazard.hotspot.left}%`,
              top: `${hazard.hotspot.top}%`,
              width: `${hazard.hotspot.width}%`,
              zIndex: isFound ? 5 : (hazard.hotspotPriority ?? 20),
            }}
            type="button"
          >
            {isFound && (
              <ResolvedOverlay hazard={hazard} />
            )}
            {SHOW_HOTSPOT_DEBUG && !isFound && (
              <span className="absolute left-1 top-1 rounded bg-[#06111F]/90 px-2 py-1 text-[10px] font-black tracking-wide text-[#DFF6FF]">
                {hazard.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ResolvedOverlay({ hazard }: { hazard: Hazard }) {
  const markerLeft = hazard.resolvedMarker?.left ?? 50;
  const markerTop = hazard.resolvedMarker?.top ?? 50;

  return (
    <span
      className="pointer-events-none absolute inset-0 overflow-visible rounded-xl"
      style={{ animation: "resolvedFade 420ms ease-out both" }}
    >
      <RepairPatch effect={hazard.resolvedEffect} />
      <span
        className="absolute inline-flex max-w-max -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#6FD3FF]/45 bg-[#06111F]/88 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wide text-[#DFF6FF] shadow-[0_0_22px_rgba(88,214,141,0.26)] backdrop-blur-sm sm:text-[10px]"
        style={{ left: `${markerLeft}%`, top: `${markerTop}%` }}
      >
        <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#58D68D] text-[11px] leading-none text-[#06111F]">
          ✓
        </span>
        <span>{hazard.resolvedLabel}</span>
      </span>
    </span>
  );
}

function RepairPatch({ effect }: { effect?: Hazard["resolvedEffect"] }) {
  if (!effect) {
    return <span className="absolute inset-0 bg-[#58D68D]/5" />;
  }

  if (effect === "spill") {
    return (
      <span className="absolute inset-x-[8%] bottom-[18%] h-[42%] rounded-[999px] bg-[#DFF6FF]/18 shadow-[0_0_28px_rgba(111,211,255,0.2)]" />
    );
  }

  if (effect === "cable") {
    return (
      <span className="absolute left-[6%] top-1/2 h-2 w-[88%] -translate-y-1/2 rounded-full bg-[#58D68D]/22 shadow-[0_0_18px_rgba(88,214,141,0.25)]" />
    );
  }

  if (effect === "drawer") {
    return (
      <span className="absolute inset-x-[10%] top-[32%] h-[34%] rounded-md border border-[#6FD3FF]/24 bg-[#0A3D78]/22 shadow-[0_0_18px_rgba(111,211,255,0.18)]" />
    );
  }

  if (effect === "path" || effect === "access") {
    return (
      <span className="absolute inset-[10%] rounded-lg border border-[#58D68D]/30 bg-[#58D68D]/8 shadow-[inset_0_0_24px_rgba(88,214,141,0.12)]" />
    );
  }

  return (
    <span className="absolute inset-[12%] rounded-lg border border-[#6FD3FF]/24 bg-[#58D68D]/7 shadow-[inset_0_0_22px_rgba(111,211,255,0.12)]" />
  );
}

function SceneImage({
  alt,
  priority = false,
  sizes,
  src,
}: {
  alt: string;
  priority?: boolean;
  sizes: string;
  src: string;
}) {
  const [imageMissing, setImageMissing] = useState(false);

  return (
    <>
      <Image
        alt={alt}
        className="h-full w-full object-contain"
        fill
        onError={() => setImageMissing(true)}
        priority={priority}
        sizes={sizes}
        src={src}
      />
      {imageMissing && <MissingSceneNotice />}
    </>
  );
}

function MissingSceneNotice() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_center,rgba(10,61,120,0.45),rgba(6,17,31,0.96))] p-6">
      <div className="max-w-md rounded-xl border border-[#6FD3FF]/25 bg-[#06111F]/85 p-5 text-center shadow-2xl shadow-[#03101d]/50">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-[#6FD3FF]">Scene image missing</p>
        <p className="mt-3 text-sm leading-6 text-[#DFF6FF]">
          Add the configured scenario image under <span className="font-mono text-[#6FD3FF]">/public</span> to display
          the image-based challenge scene. The hotspot overlay is already wired and ready.
        </p>
      </div>
    </div>
  );
}

function MiniWarehouse({ scenario }: { scenario: Scenario }) {
  return (
    <div className="relative h-full min-h-[220px] w-full overflow-hidden rounded-lg bg-[#0B1D33] sm:min-h-[250px]">
      <Image
        alt={`${scenario.title} preview`}
        className="object-cover"
        fill
        sizes="(min-width: 1024px) calc(100vw - 480px), 100vw"
        src={scenario.previewImage}
      />
    </div>
  );
}

function Stat({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "accent" | "danger" | "normal";
  value: string;
}) {
  const toneClass = {
    accent: "border-[#6FD3FF]/45 bg-[#0A3D78]/45 text-[#DFF6FF]",
    danger:
      "animate-pulse border-[#6FD3FF]/70 bg-[#06111F] text-[#6FD3FF] shadow-[0_0_22px_rgba(111,211,255,0.22)]",
    normal: "border-[#6FD3FF]/15 bg-[#0B1D33] text-[#DFF6FF]",
  }[tone];

  return (
    <div
      className={`min-w-[88px] flex-1 rounded-lg border px-3 py-2.5 text-center sm:min-w-24 sm:flex-none sm:px-4 sm:py-3 ${toneClass}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-70 sm:text-[11px] sm:tracking-[0.18em]">
        {label}
      </p>
      <p className="text-xl font-black leading-none sm:text-2xl">{value}</p>
    </div>
  );
}

function FeedbackNotice({ feedback }: { feedback: Feedback }) {
  const toneClass = {
    danger: "border-[#FF6B6B]/45 bg-[#FF6B6B]/12 text-[#FFD6D6]",
    info: "border-[#6FD3FF]/35 bg-[#0A3D78]/45 text-[#DFF6FF]",
    success: "border-[#58D68D]/40 bg-[#58D68D]/12 text-[#CFFFE1]",
  }[feedback.tone];

  return (
    <div
      className={`pointer-events-none absolute left-3 top-3 z-30 w-fit max-w-[calc(100%-1.5rem)] animate-[feedback-float_1.6s_ease-out_forwards] rounded-lg border px-4 py-2 text-sm font-black shadow-lg shadow-[#03101d]/35 ${toneClass}`}
    >
      {feedback.text}
    </div>
  );
}

function ResultsScreen({
  foundCount,
  foundHazards,
  hintsUsed,
  onPlayAgain,
  playerFullName,
  rank,
  recommendation,
  recordMessage,
  score,
  selectedDifficulty,
  scenario,
  timeLeft,
  wrongClicks,
}: {
  foundCount: number;
  foundHazards: string[];
  hintsUsed: number;
  onPlayAgain: () => void;
  playerFullName: string;
  rank: string;
  recommendation: string;
  recordMessage: string;
  score: number;
  selectedDifficulty: (typeof difficulties)[DifficultyId];
  scenario: Scenario;
  timeLeft: number;
  wrongClicks: number;
}) {
  const [showReview, setShowReview] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [copyFallbackText, setCopyFallbackText] = useState("");
  const [downloadMessage, setDownloadMessage] = useState("");
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const totalHazards = scenario.hazards.length;
  const timeBonus = getTimeBonus(timeLeft);
  const maxTotalScore = getMaxTotalScore(selectedDifficulty, totalHazards);
  const finalScore = getFinalScore(score, timeLeft);
  const scorePercentage = getScorePercentage(score, timeLeft, selectedDifficulty, totalHazards);
  const accuracy = getAccuracyPercentage(foundCount, wrongClicks);
  const completedAt = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date()),
    [],
  );
  const foundHazardDetails = scenario.hazards.filter((hazard) => foundHazards.includes(hazard.id));
  const finalShareText = `I scored ${scorePercentage}% in LABORIA Safety Rush — ${scenario.title} (${selectedDifficulty.label}) and earned ${rank}.\n\nCan you beat me? Play here:\n${LIVE_APP_URL}`;

  async function downloadResultSummary() {
    await downloadResultPdf({
      accuracy,
      completedAt,
      difficulty: selectedDifficulty.label,
      finalScore,
      foundCount,
      hintsUsed,
      maxTotalScore,
      playerName: playerFullName,
      rank,
      scorePercentage,
      scenarioTitle: scenario.title,
      timeLeft,
      totalHazards,
      wrongClicks,
    });
    setDownloadMessage("Result summary downloaded.");
  }

  async function copyResultText() {
    setCopyFallbackText("");

    try {
      await navigator.clipboard.writeText(finalShareText);
      setCopyMessage("Result copied!");
    } catch {
      setCopyMessage("Copy unavailable. Select the text below.");
      setCopyFallbackText(finalShareText);
    }
  }

  async function shareResult() {
    if (!navigator.share) {
      setIsSharePanelOpen(true);
      return;
    }

    try {
      await navigator.share({
        title: "LABORIA Safety Rush Result",
        text: finalShareText,
        url: LIVE_APP_URL,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setIsSharePanelOpen(true);
    }
  }

  return (
    <section className="grid flex-1 place-items-center py-5 sm:py-7">
      <div className="w-full max-w-5xl rounded-xl border border-[#6FD3FF]/15 bg-[#0B1D33]/90 p-4 text-center shadow-2xl shadow-[#03101d]/40 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6FD3FF]">Challenge Complete</p>
        <h2 className="mt-2 text-3xl font-black text-[#DFF6FF] sm:text-4xl">{rank}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#9FC3DD]">{recommendation}</p>
        {recordMessage && (
          <p className="mx-auto mt-3 max-w-2xl rounded-lg border border-[#58D68D]/30 bg-[#58D68D]/10 p-3 text-sm font-black text-[#CFFFE1]">
            {recordMessage}
          </p>
        )}

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <ResultMetric label="Final Score" value={`${finalScore}/${maxTotalScore}`} detail={`${scorePercentage}%`} />
          <ResultMetric label="Scenario" value={scenario.title} />
          <ResultMetric label="Difficulty" value={selectedDifficulty.label} detail={`${selectedDifficulty.seconds}s`} />
          <ResultMetric label="Hazards Found" value={`${foundCount}/${scenario.hazards.length}`} />
          <ResultMetric label="Time Bonus" value={`+${timeBonus}`} detail={`${timeLeft}s remaining`} />
          <ResultMetric label="Wrong Clicks" value={wrongClicks.toString()} />
          <ResultMetric label="Hints Used" value={hintsUsed.toString()} detail={`-${hintsUsed * HINT_PENALTY} points`} />
          <ResultMetric label="Accuracy" value={`${accuracy}%`} detail="correct clicks / total clicks" />
          <ResultMetric label="Score Percentage" value={`${scorePercentage}%`} detail="final score vs maximum" />
        </div>

        <p className="mx-auto mt-4 max-w-3xl rounded-lg border border-[#6FD3FF]/15 bg-[#06111F]/50 p-3 text-xs leading-5 text-[#DFF6FF] sm:text-sm">
          Score calculation: {foundCount} correct hazards × {CORRECT_HAZARD_POINTS} points, minus {wrongClicks} wrong
          clicks × {selectedDifficulty.wrongClickPenalty} points, minus {hintsUsed} hint
          {hintsUsed === 1 ? "" : "s"} × {HINT_PENALTY} points, plus {timeBonus} time bonus point
          {timeBonus === 1 ? "" : "s"}. Maximum possible score for {selectedDifficulty.label} is {maxTotalScore}.
        </p>

        <ResultCertificate
          accuracy={accuracy}
          completedAt={completedAt}
          downloadMessage={downloadMessage}
          difficulty={selectedDifficulty.label}
          finalScore={finalScore}
          foundCount={foundCount}
          hintsUsed={hintsUsed}
          maxTotalScore={maxTotalScore}
          playerFullName={playerFullName}
          rank={rank}
          scorePercentage={scorePercentage}
          scenarioTitle={scenario.title}
          scenarioResultTitle={scenario.resultTitle}
          timeLeft={timeLeft}
          totalHazards={totalHazards}
          wrongClicks={wrongClicks}
          onDownload={downloadResultSummary}
        />

        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            className="min-h-11 w-full rounded-lg bg-[#6FD3FF] px-5 py-2.5 text-sm font-black text-[#06111F] transition hover:bg-[#DFF6FF] focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/35 sm:min-h-0 sm:w-auto"
            onClick={onPlayAgain}
          >
            Play Again
          </button>
          <button
            className="min-h-11 w-full rounded-lg border border-[#6FD3FF]/40 bg-[#0A3D78]/30 px-5 py-2.5 text-sm font-black text-[#DFF6FF] transition hover:bg-[#0A3D78]/55 focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/25 sm:min-h-0 sm:w-auto"
            onClick={() => setShowReview((current) => !current)}
            type="button"
          >
            {showReview ? "Hide Found Hazards" : "Review Found Hazards"}
          </button>
          <button
            className="min-h-11 w-full rounded-lg border border-[#6FD3FF]/40 bg-[#0A3D78]/30 px-5 py-2.5 text-sm font-black text-[#DFF6FF] transition hover:bg-[#0A3D78]/55 focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/25 sm:min-h-0 sm:w-auto"
            onClick={copyResultText}
            type="button"
          >
            Copy Result
          </button>
          <button
            className="min-h-11 w-full rounded-lg border border-[#6FD3FF]/40 bg-[#0A3D78]/30 px-5 py-2.5 text-sm font-black text-[#DFF6FF] transition hover:bg-[#0A3D78]/55 focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/25 sm:min-h-0 sm:w-auto"
            onClick={shareResult}
            type="button"
          >
            Share Result
          </button>
        </div>

        {isSharePanelOpen && (
          <ShareOptionsPanel
            onClose={() => setIsSharePanelOpen(false)}
            onCopy={copyResultText}
            shareText={finalShareText}
          />
        )}

        {copyMessage && (
          <div className="mx-auto mt-4 max-w-2xl rounded-lg border border-[#6FD3FF]/20 bg-[#0A3D78]/25 p-3 text-sm leading-6 text-[#DFF6FF]">
            <p className="font-black text-[#58D68D]">{copyMessage}</p>
            {copyFallbackText && (
              <textarea
                className="mt-3 h-20 w-full resize-none rounded-lg border border-[#6FD3FF]/20 bg-[#06111F]/70 p-3 text-sm text-[#DFF6FF] outline-none"
                readOnly
                value={copyFallbackText}
              />
            )}
          </div>
        )}

        {showReview && (
          <div className="mt-5 text-left">
            <h3 className="text-lg font-black text-[#DFF6FF]">Review Found Hazards</h3>
            {foundHazardDetails.length > 0 ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {foundHazardDetails.map((hazard) => (
                  <article
                    className="rounded-lg border border-[#6FD3FF]/15 bg-[#06111F]/55 p-3"
                    key={hazard.id}
                  >
                    <h4 className="text-sm font-black text-[#6FD3FF]">{hazard.name}</h4>
                    <p className="mt-1.5 text-xs leading-5 text-[#DFF6FF] sm:text-sm">{hazard.explanation}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-lg border border-[#6FD3FF]/15 bg-[#06111F]/55 p-3 text-sm text-[#9FC3DD]">
                No hazards were found in this attempt. Play again and inspect the visible workplace risks carefully.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ResultMetric({ detail, label, value }: { detail?: string; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#6FD3FF]/15 bg-[#06111F]/55 p-3 sm:p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9FC3DD]">{label}</p>
      <p className="mt-1.5 break-words text-xl font-black leading-none text-[#6FD3FF] sm:text-3xl">{value}</p>
      {detail && <p className="mt-1.5 text-[11px] font-semibold text-[#9FC3DD]">{detail}</p>}
    </div>
  );
}

function ShareOptionsPanel({
  onClose,
  onCopy,
  shareText,
}: {
  onClose: () => void;
  onCopy: () => void;
  shareText: string;
}) {
  const encodedShareText = encodeURIComponent(shareText);
  const encodedAppUrl = encodeURIComponent(LIVE_APP_URL);
  const shareOptions = [
    {
      href: `https://wa.me/?text=${encodedShareText}`,
      label: "WhatsApp",
    },
    {
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedAppUrl}`,
      label: "Facebook",
    },
    {
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedAppUrl}`,
      label: "LinkedIn",
    },
  ];

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-[#06111F]/80 px-3 py-5 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-xl border border-[#6FD3FF]/25 bg-[#0B1D33] p-4 text-left shadow-[0_0_54px_rgba(111,211,255,0.16)] ring-1 ring-[#DFF6FF]/8 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6FD3FF]">Share Result</p>
            <h3 className="mt-2 text-2xl font-black text-[#DFF6FF]">Challenge your network</h3>
          </div>
          <button
            className="rounded-lg border border-[#6FD3FF]/35 bg-[#06111F]/60 px-3 py-2 text-sm font-black text-[#DFF6FF] transition hover:bg-[#0A3D78]/45 focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/20"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <p className="mt-3 rounded-lg border border-[#6FD3FF]/15 bg-[#06111F]/55 p-3 text-sm leading-6 text-[#DFF6FF]">
          {shareText}
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {shareOptions.map((option) => (
            <a
              className="min-h-11 rounded-lg border border-[#6FD3FF]/40 bg-[#0A3D78]/30 px-4 py-2.5 text-center text-sm font-black text-[#DFF6FF] transition hover:bg-[#0A3D78]/55 focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/25"
              href={option.href}
              key={option.label}
              rel="noopener noreferrer"
              target="_blank"
            >
              {option.label}
            </a>
          ))}
          <button
            className="min-h-11 rounded-lg bg-[#6FD3FF] px-4 py-2.5 text-sm font-black text-[#06111F] transition hover:bg-[#DFF6FF] focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/35 sm:col-span-2"
            onClick={onCopy}
            type="button"
          >
            Copy Result
          </button>
        </div>

        <p className="mt-3 text-xs leading-5 text-[#9FC3DD]">
          Facebook and LinkedIn may only share the game link. For Instagram, copy the result text and share it manually.
        </p>
      </div>
    </div>
  );
}

function ResultCertificate({
  accuracy,
  completedAt,
  downloadMessage,
  difficulty,
  finalScore,
  foundCount,
  hintsUsed,
  maxTotalScore,
  onDownload,
  playerFullName,
  rank,
  scorePercentage,
  scenarioResultTitle,
  scenarioTitle,
  timeLeft,
  totalHazards,
  wrongClicks,
}: {
  accuracy: number;
  completedAt: string;
  downloadMessage: string;
  difficulty: string;
  finalScore: number;
  foundCount: number;
  hintsUsed: number;
  maxTotalScore: number;
  onDownload: () => void;
  playerFullName: string;
  rank: string;
  scorePercentage: number;
  scenarioResultTitle: string;
  scenarioTitle: string;
  timeLeft: number;
  totalHazards: number;
  wrongClicks: number;
}) {
  const certificateStats = [
    { label: "Player Rank", value: rank },
    { label: "Scenario", value: scenarioTitle },
    { label: "Final Score", value: `${finalScore}/${maxTotalScore}` },
    { label: "Score", value: `${scorePercentage}%` },
    { label: "Hazards Found", value: `${foundCount}/${totalHazards}` },
    { label: "Difficulty", value: difficulty },
    { label: "Accuracy", value: `${accuracy}%` },
    { label: "Wrong Clicks", value: wrongClicks.toString() },
    { label: "Hints Used", value: hintsUsed.toString() },
    { label: "Time Remaining", value: `${timeLeft}s` },
    { label: "Completed", value: completedAt },
  ];

  return (
    <section className="mt-5 rounded-xl border border-[#6FD3FF]/25 bg-[linear-gradient(135deg,rgba(6,17,31,0.96),rgba(10,61,120,0.48))] p-4 text-left shadow-[0_0_34px_rgba(111,211,255,0.12)] sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6FD3FF]">
            Powered by Laboria Global HS Solutions
          </p>
          <h3 className="mt-2 text-2xl font-black text-[#DFF6FF]">LABORIA Safety Rush Result</h3>
          <p className="mt-1 text-sm font-semibold text-[#6FD3FF]">{scenarioResultTitle}</p>
          <p className="mt-2 text-sm font-bold text-[#9FC3DD]">
            Awarded to: <span className="text-[#DFF6FF]">{playerFullName}</span>
          </p>
        </div>
        <button
          className="min-h-11 w-full rounded-lg border border-[#6FD3FF]/40 bg-[#0A3D78]/40 px-4 py-2 text-sm font-black text-[#DFF6FF] transition hover:bg-[#0A3D78]/65 focus:outline-none focus:ring-4 focus:ring-[#6FD3FF]/25 sm:min-h-0 sm:w-auto"
          onClick={onDownload}
          type="button"
        >
          Download Result Summary
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {certificateStats.map((stat) => (
          <div className="rounded-lg border border-[#6FD3FF]/12 bg-[#06111F]/50 p-3" key={stat.label}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9FC3DD]">{stat.label}</p>
            <p className="mt-1.5 break-words text-sm font-black text-[#DFF6FF]">{stat.value}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 border-t border-[#6FD3FF]/15 pt-3 text-sm leading-6 text-[#9FC3DD]">
        This result reflects performance in a simulated workplace hazard identification challenge.
      </p>
      {downloadMessage && <p className="mt-3 text-sm font-black text-[#58D68D]">{downloadMessage}</p>}
    </section>
  );
}

function readLocalResults() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawResults = window.localStorage.getItem(LOCAL_RESULTS_KEY);

    if (!rawResults) {
      return [];
    }

    const parsedResults = JSON.parse(rawResults);

    if (!Array.isArray(parsedResults)) {
      return [];
    }

    return sortResults(parsedResults.filter(isLocalResult)).slice(0, MAX_LOCAL_RESULTS);
  } catch {
    return [];
  }
}

function writeLocalResults(results: LocalResult[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LOCAL_RESULTS_KEY, JSON.stringify(results.slice(0, MAX_LOCAL_RESULTS)));
  } catch {
    // localStorage can fail in private browsing or restricted environments; gameplay should continue.
  }
}

function isLocalResult(result: unknown): result is LocalResult {
  if (!result || typeof result !== "object") {
    return false;
  }

  const candidate = result as Partial<LocalResult>;

  return (
    typeof candidate.playerName === "string" &&
    typeof candidate.playerSurname === "string" &&
    typeof candidate.scenarioName === "string" &&
    typeof candidate.scenarioId === "string" &&
    typeof candidate.difficulty === "string" &&
    typeof candidate.finalScore === "number" &&
    typeof candidate.maxScore === "number" &&
    typeof candidate.scorePercentage === "number" &&
    typeof candidate.hazardsFound === "number" &&
    typeof candidate.totalHazards === "number" &&
    typeof candidate.wrongClicks === "number" &&
    typeof candidate.timeRemaining === "number" &&
    typeof candidate.completedAt === "string" &&
    typeof candidate.rankTitle === "string"
  );
}

function sortResults(results: LocalResult[]) {
  return [...results].sort(compareResults);
}

function compareResults(first: LocalResult, second: LocalResult) {
  if (second.scorePercentage !== first.scorePercentage) {
    return second.scorePercentage - first.scorePercentage;
  }

  if (second.finalScore !== first.finalScore) {
    return second.finalScore - first.finalScore;
  }

  if (second.timeRemaining !== first.timeRemaining) {
    return second.timeRemaining - first.timeRemaining;
  }

  return first.wrongClicks - second.wrongClicks;
}

function getBestResult(results: LocalResult[], scenarioId: ScenarioId, difficulty: string) {
  return (
    sortResults(results).find((result) => result.scenarioId === scenarioId && result.difficulty === difficulty) ?? null
  );
}

function formatPlayerName(result: Pick<LocalResult, "playerName" | "playerSurname">) {
  return `${result.playerName} ${result.playerSurname}`.trim() || "Unnamed Player";
}

function formatResultDate(completedAt: string) {
  const date = new Date(completedAt);

  if (Number.isNaN(date.getTime())) {
    return completedAt;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getResultKey(result: LocalResult, index: number) {
  return `${result.completedAt}-${result.scenarioId}-${result.difficulty}-${index}`;
}

function getTimeBonus(timeLeft: number) {
  return Math.floor(timeLeft / 5);
}

function getMaxTotalScore(difficulty: (typeof difficulties)[DifficultyId], totalHazards: number) {
  return totalHazards * CORRECT_HAZARD_POINTS + Math.floor(difficulty.seconds / 5);
}

function getFinalScore(score: number, timeLeft: number) {
  return Math.max(0, score + getTimeBonus(timeLeft));
}

function getScorePercentage(
  score: number,
  timeLeft: number,
  difficulty: (typeof difficulties)[DifficultyId],
  totalHazards: number,
) {
  return Math.min(100, Math.round((getFinalScore(score, timeLeft) / getMaxTotalScore(difficulty, totalHazards)) * 100));
}

function getAccuracyPercentage(foundCount: number, wrongClicks: number) {
  const totalClicks = foundCount + wrongClicks;

  if (totalClicks === 0) {
    return 0;
  }

  return Math.round((foundCount / totalClicks) * 100);
}

function getResult(scorePercentage: number) {
  if (scorePercentage >= 95) {
    return {
      rank: "Elite Safety Inspector",
      recommendation: "Excellent performance. You demonstrated strong HS inspection awareness.",
    };
  }

  if (scorePercentage >= 85) {
    return {
      rank: "LABORIA Safety Expert",
      recommendation: "Strong inspection performance. You identified key workplace risks efficiently.",
    };
  }

  if (scorePercentage >= 70) {
    return {
      rank: "Safety Pro",
      recommendation: "Strong inspection performance. You identified key workplace risks efficiently.",
    };
  }

  if (scorePercentage >= 50) {
    return {
      rank: "Hazard Spotter",
      recommendation: "Good progress. Focus on recognizing hidden operational hazards.",
    };
  }

  return {
    rank: "Needs Improvement",
    recommendation: "Review basic hazard identification and repeat the challenge.",
  };
}

function playFeedbackSound(kind: SoundKind, soundEnabled: boolean) {
  if (!soundEnabled || typeof window === "undefined") {
    return;
  }

  const AudioContextConstructor =
    window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) {
    return;
  }

  const audioContext = new AudioContextConstructor();
  const patterns: Record<SoundKind, Array<{ duration: number; frequency: number; gain: number }>> = {
    complete: [
      { duration: 0.09, frequency: 523.25, gain: 0.035 },
      { duration: 0.12, frequency: 659.25, gain: 0.035 },
      { duration: 0.16, frequency: 783.99, gain: 0.03 },
    ],
    correct: [
      { duration: 0.08, frequency: 659.25, gain: 0.03 },
      { duration: 0.1, frequency: 880, gain: 0.026 },
    ],
    hint: [{ duration: 0.12, frequency: 587.33, gain: 0.022 }],
    wrong: [
      { duration: 0.08, frequency: 220, gain: 0.028 },
      { duration: 0.12, frequency: 164.81, gain: 0.026 },
    ],
  };

  let offset = 0;

  patterns[kind].forEach((tone) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const startAt = audioContext.currentTime + offset;
    const endAt = startAt + tone.duration;

    oscillator.type = kind === "wrong" ? "sawtooth" : "sine";
    oscillator.frequency.setValueAtTime(tone.frequency, startAt);
    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(tone.gain, startAt + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(endAt + 0.02);
    offset += tone.duration + 0.035;
  });

  window.setTimeout(() => void audioContext.close(), (offset + 0.2) * 1000);
}

async function downloadResultPdf(result: ResultPdfData) {
  const canvas = document.createElement("canvas");
  canvas.width = 1240;
  canvas.height = 1754;

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const logo = await loadPdfImage("/laboria-logo.png");
  const pdfJpegData = drawResultPdfCanvas(canvas, context, logo, result);
  const pdfBytes = createImagePdf(pdfJpegData.bytes, canvas.width, canvas.height);
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "laboria-safety-rush-result.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function drawResultPdfCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  result: ResultPdfData,
) {
  context.fillStyle = "#06111F";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "rgba(10,61,120,0.82)");
  gradient.addColorStop(0.45, "rgba(11,29,51,0.96)");
  gradient.addColorStop(1, "rgba(6,17,31,1)");
  context.fillStyle = gradient;
  context.fillRect(48, 48, canvas.width - 96, canvas.height - 96);

  context.strokeStyle = "#6FD3FF";
  context.globalAlpha = 0.52;
  context.lineWidth = 3;
  roundRect(context, 48, 48, canvas.width - 96, canvas.height - 96, 26);
  context.stroke();
  context.globalAlpha = 1;

  context.fillStyle = "rgba(223,246,255,0.92)";
  roundRect(context, 92, 86, 380, 214, 18);
  context.fill();
  context.drawImage(logo, 112, 106, 340, 191);

  context.fillStyle = "#6FD3FF";
  context.font = "700 28px Arial";
  context.fillText("LABORIA SAFETY RUSH", 520, 132);
  context.fillStyle = "#DFF6FF";
  context.font = "900 58px Arial";
  context.fillText("Result Summary", 520, 205);
  context.fillStyle = "#9FC3DD";
  context.font = "700 24px Arial";
  context.fillText(`Scenario: ${result.scenarioTitle}`, 520, 254);
  context.font = "400 23px Arial";
  wrapCanvasText(context, "Simulated workplace hazard identification challenge", 520, 288, 580, 30);

  context.fillStyle = "#6FD3FF";
  context.font = "700 24px Arial";
  context.fillText("AWARDED TO", 92, 354);
  context.fillStyle = "#DFF6FF";
  context.font = "900 42px Arial";
  context.fillText(result.playerName, 92, 410);

  context.fillStyle = "#DFF6FF";
  context.font = "900 52px Arial";
  context.fillText(result.rank, 92, 500);
  context.fillStyle = "#6FD3FF";
  context.font = "900 96px Arial";
  context.fillText(`${result.scorePercentage}%`, 92, 608);
  context.fillStyle = "#9FC3DD";
  context.font = "700 26px Arial";
  context.fillText(`Final score: ${result.finalScore}/${result.maxTotalScore}`, 92, 654);

  const stats = [
    ["Player rank", result.rank],
    ["Scenario", result.scenarioTitle],
    ["Final score", `${result.finalScore}/${result.maxTotalScore}`],
    ["Score percentage", `${result.scorePercentage}%`],
    ["Hazards found", `${result.foundCount}/${result.totalHazards}`],
    ["Difficulty", result.difficulty],
    ["Accuracy", `${result.accuracy}%`],
    ["Wrong clicks", result.wrongClicks.toString()],
    ["Hints used", result.hintsUsed.toString()],
    ["Time remaining", `${result.timeLeft}s`],
    ["Completed", result.completedAt],
  ];

  stats.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 92 + column * 528;
    const y = 720 + row * 96;

    context.fillStyle = "rgba(6,17,31,0.62)";
    roundRect(context, x, y, 472, 76, 16);
    context.fill();
    context.strokeStyle = "rgba(111,211,255,0.26)";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = "#9FC3DD";
    context.font = "700 20px Arial";
    context.fillText(label.toUpperCase(), x + 26, y + 30);
    context.fillStyle = "#DFF6FF";
    context.font = "900 24px Arial";
    context.fillText(value, x + 26, y + 61);
  });

  context.fillStyle = "rgba(10,61,120,0.34)";
  roundRect(context, 92, 1342, 1056, 132, 18);
  context.fill();
  context.strokeStyle = "rgba(111,211,255,0.26)";
  context.stroke();
  context.fillStyle = "#DFF6FF";
  context.font = "700 27px Arial";
  wrapCanvasText(
    context,
    "This result reflects performance in a simulated workplace hazard identification challenge.",
    130,
    1398,
    980,
    38,
  );

  context.fillStyle = "#6FD3FF";
  context.font = "900 24px Arial";
  context.fillText("Powered by Laboria Global HS Solutions", 92, 1598);
  context.fillStyle = "#9FC3DD";
  context.font = "400 20px Arial";
  context.fillText("LABORIA Safety Rush Result Summary", 92, 1636);

  const jpeg = canvas.toDataURL("image/jpeg", 0.92);
  return {
    bytes: dataUrlToBytes(jpeg),
  };
}

function loadPdfImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let lineY = y;

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;

    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  });

  if (line) {
    context.fillText(line, x, lineY);
  }
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function createImagePdf(jpegBytes: Uint8Array, imageWidth: number, imageHeight: number) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  function appendAscii(value: string) {
    const bytes = encoder.encode(value);
    chunks.push(bytes);
    length += bytes.length;
  }

  function appendBytes(bytes: Uint8Array) {
    chunks.push(bytes);
    length += bytes.length;
  }

  function beginObject(id: number) {
    offsets[id] = length;
    appendAscii(`${id} 0 obj\n`);
  }

  appendAscii("%PDF-1.4\n");
  beginObject(1);
  appendAscii("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  beginObject(2);
  appendAscii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  beginObject(3);
  appendAscii(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );
  beginObject(4);
  appendAscii(
    `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
  );
  appendBytes(jpegBytes);
  appendAscii("\nendstream\nendobj\n");

  const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;
  beginObject(5);
  appendAscii(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`);

  const xrefOffset = length;
  appendAscii(`xref\n0 6\n0000000000 65535 f \n`);
  for (let id = 1; id <= 5; id += 1) {
    appendAscii(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  appendAscii(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const pdf = new Uint8Array(length);
  let offset = 0;

  chunks.forEach((chunk) => {
    pdf.set(chunk, offset);
    offset += chunk.length;
  });

  return pdf;
}

