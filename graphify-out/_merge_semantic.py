import json, glob
from pathlib import Path
from graphify.cache import save_semantic_cache

chunks = sorted(glob.glob('graphify-out/.graphify_chunk_*.json'))
all_nodes, all_edges, all_hyperedges = [], [], []
total_in, total_out = 0, 0
for c in chunks:
    d = json.loads(Path(c).read_text(encoding='utf-8'))
    all_nodes += d.get('nodes', [])
    all_edges += d.get('edges', [])
    all_hyperedges += d.get('hyperedges', [])
    total_in += d.get('input_tokens', 0)
    total_out += d.get('output_tokens', 0)

Path('graphify-out/.graphify_semantic_new.json').write_text(json.dumps({
    'nodes': all_nodes, 'edges': all_edges, 'hyperedges': all_hyperedges,
    'input_tokens': total_in, 'output_tokens': total_out,
}, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'Merged {len(chunks)} chunks: {total_in} in / {total_out} out tokens, {len(all_nodes)} nodes, {len(all_edges)} edges')

saved = save_semantic_cache(all_nodes, all_edges, all_hyperedges)
print(f'Cached {saved} files')

# Merge with previously cached
cached_path = Path('graphify-out/.graphify_cached.json')
cached = json.loads(cached_path.read_text(encoding='utf-8')) if cached_path.exists() else {'nodes':[],'edges':[],'hyperedges':[]}

all_combined_nodes = cached['nodes'] + all_nodes
all_combined_edges = cached['edges'] + all_edges
all_combined_hyperedges = cached.get('hyperedges', []) + all_hyperedges
seen = set()
deduped = []
for n in all_combined_nodes:
    if n['id'] not in seen:
        seen.add(n['id'])
        deduped.append(n)

merged = {
    'nodes': deduped,
    'edges': all_combined_edges,
    'hyperedges': all_combined_hyperedges,
    'input_tokens': total_in,
    'output_tokens': total_out,
}
Path('graphify-out/.graphify_semantic.json').write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'Final: {len(deduped)} nodes, {len(all_combined_edges)} edges ({len(cached["nodes"])} from cache, {len(all_nodes)} new)')
