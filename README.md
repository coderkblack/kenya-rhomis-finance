# Kenya RHoMIS Finance

Kenya smallholder credit scoring and farmer segmentation web app.

## Start

**Terminal 1 — API (FastAPI)**
```bash
cd api
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend (Next.js)**
```bash
cd frontend
npm run dev
```

App: http://localhost:3000  
API docs: http://localhost:8000/docs

## Add Groq key (optional — for conversational intake + narratives)
Edit `frontend/.env.local`:
```
GROQ_API_KEY=gsk_...
NEXT_PUBLIC_GROQ_ENABLED=true
```

## Pages
| Route | Description |
|---|---|
| `/` | Overview — stats, segment cards, training countries |
| `/score` | Manual multi-step scoring form |
| `/intake` | Conversational intake (requires Groq key) |
| `/segments` | Detailed Kenya segment profiles |
| `/model` | Model comparison table — all results, feature list |

## API endpoints
| Endpoint | Description |
|---|---|
| `POST /score` | Score a household from raw inputs |
| `GET /metadata` | Full model metadata (features, segments, results) |
| `GET /health` | Which models loaded successfully |

## Artifacts used
Models loaded from `../artifacts_kenya/`:
- **Primary model**: Random Forest (443 trees, 27 features)
- **Comparison**: XGBoost, Logistic Regression, Decision Tree
- **Segmentation**: K-Means k=4 (14 features, Kenya only)
- **Excluded** (NumPy BitGenerator mismatch): GB, Stacking models
