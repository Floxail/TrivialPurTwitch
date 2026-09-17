import json
from graphify.build import build_from_json
from graphify.cluster import score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from pathlib import Path

extraction = json.loads(Path('graphify-out/.graphify_extract.json').read_text(encoding='utf-8'))
detection  = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8'))
analysis   = json.loads(Path('graphify-out/.graphify_analysis.json').read_text(encoding='utf-8'))

G = build_from_json(extraction)
communities = {int(k): v for k, v in analysis['communities'].items()}
cohesion = {int(k): v for k, v in analysis['cohesion'].items()}
tokens = {'input': extraction.get('input_tokens', 0), 'output': extraction.get('output_tokens', 0)}

labels = {
    0: "DB Migration Tool",
    1: "Lumon Terminal UI System",
    2: "Go/Rust Microservice Profiles",
    3: "Core App Concepts & Patterns",
    4: "FastAPI Backend Profiles",
    5: "Vercel Serverless API Layer",
    6: "Django Monolith Profiles",
    7: "Node.js Express Profiles",
    8: "API Scaffolding Tool",
    9: "Frontend API Service Layer",
    10: "API Load Testing Tool",
    11: "QCM Conversion Scripts",
    12: "Navigation & Display UI",
    13: "npm Package Dependencies",
    14: "Admin Moderation UI",
    15: "Backend Stack Decision Engine",
    16: "TypeScript Config",
    17: "Help & Onboarding UI",
    18: "Answer Validation & Twitch",
    19: "Auth & Contribution Flow",
    20: "Stats & Analytics UI",
    21: "API TypeScript Config",
    22: "Settings & Scoring System",
    23: "Skills Lock Config",
    24: "Browser Compatibility Config",
    25: "App Bootstrap & Lazy Loading",
    26: "Build & Deploy Scripts",
    27: "Scores API Service",
    28: "Twitch API Integration",
    29: "Backend Skill References",
    30: "Dev Dependencies",
    31: "Box Order Fix Script",
    32: "Question Format Converter",
    33: "Question History Service",
    34: "App Branding Assets",
    35: "Vercel Deployment Config",
    36: "API Package Config",
    37: "Stats Reset Script",
    38: "Code Review Skill",
    39: "API TS Config Entry",
    40: "Podium Component",
    41: "Default Avatar Asset",
    42: "Placeholder Icon",
    43: "Twitch Avatar Component",
    44: "Bronze Medal Icon",
    45: "Bronze Medal Asset",
    46: "Bronze Podium Asset",
    47: "Crown Icon",
    48: "App Favicon",
    49: "Gold Medal Icon",
    50: "Gold Medal SVG",
    51: "Gold Podium Ranking",
    52: "Silver Rank Asset",
    53: "Silver Medal Icon",
    54: "Silver Medal Asset",
    55: "Skills Lock Config Entry",
    56: "Icon Library",
    57: "React App Type Declarations",
    58: "App Brand Node",
    59: "Yarn Node Linker Config",
}

questions = suggest_questions(G, communities, labels)
report = generate(G, communities, cohesion, labels, analysis['gods'], analysis['surprises'], detection, tokens, '.', suggested_questions=questions)
Path('graphify-out/GRAPH_REPORT.md').write_text(report, encoding='utf-8')
Path('graphify-out/.graphify_labels.json').write_text(json.dumps({str(k): v for k, v in labels.items()}, ensure_ascii=False), encoding='utf-8')
print('Report updated with community labels')
