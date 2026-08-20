# Analysis latency report

This is a three-case engineering sample, not a performance guarantee. Each case used the stabilized production implementation exactly once on August 20, 2026: `gpt-5.6-terra`, Responses API, low reasoning effort, `store: false`, no automatic retry, the normal seven-page acquisition bound, and the existing two-wave four-family extraction contract.

## Results

| Starting page | Total | Sources | Facts | Foundation | Process | Financial | Outcome |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| MITES homepage | 117.942s | 7 | 61.596s | 24.963s | 44.833s | 27.922s | Usable with caveats; all families completed |
| Lumos Fellows homepage | 122.464s | 4 | 75.236s | 30.589s | 44.803s | 35.669s | Usable with caveats; all families completed |
| QuestBridge National College Match | 195.622s | 7 | 72.542s | 30.274s | 120.009s | 29.986s | Usable with caveats; process family timed out and other families survived |

- Minimum: **117.942 seconds**
- Median: **122.464 seconds**
- Maximum: **195.622 seconds**
- Model concurrency: facts + foundation in wave one, then process + financial in wave two. Family durations overlap inside each wave and therefore must not be summed as wall time.

Source acquisition plus discovery took 11.153s for MITES, 1.688s for Lumos, and 2.641s for QuestBridge. Text processing, cycle resolution, deterministic validation, projection assembly, and quality gating together remained below 0.4s per run. Provider generation is the dominant latency component by a wide margin.

The practical current target is honest progress and safe partial completion, not a false sub-30-second promise. Ordinary pages in this sample still took roughly two minutes. Reaching a reliable sub-60-second median requires materially faster/shorter model-family output or a different provider execution mode; source-fetch micro-optimization will not achieve it. Semantic validation must not be weakened to chase speed.

## Usage and estimated cost

| Case | Input tokens | Cached input | Output tokens | Total tokens | Estimated cost |
| --- | ---: | ---: | ---: | ---: | ---: |
| MITES | 80,681 | 0 | 18,984 | 99,665 | $0.389170 |
| Lumos | 68,939 | 54,038 | 21,413 | 90,352 | $0.297566 |
| QuestBridge | 70,295 | 38,124 | 15,838 | 86,133 | $0.262023 |
| **Total** | **219,915** | **92,162** | **56,235** | **276,150** | **$0.948759** |

The estimate uses the official direct-API text-token rates published for GPT-5.6 Terra at the measurement date: $2.00 per million uncached input tokens, $0.20 per million cached input tokens, and $12.00 per million output tokens. See [the official model page](https://developers.openai.com/api/docs/models/gpt-5.6-terra).

The timed-out QuestBridge process response did not return usage telemetry. The $0.948759 total therefore accounts only for tokens reported by completed Responses and may understate the provider dashboard charge if the failed request incurred billable work.

## Interpretation

- Live streaming materially improves perceived honesty because acquisition, family completion, validated previews, and partial failure are visible as they actually occur.
- The four-family design contains failure: QuestBridge still produced a caveated draft after one family exhausted its 120-second bound.
- Prompt caching reduced later input cost, but output length and generation latency remain substantial.
- These three programs are development cases, not an independent latency benchmark or population estimate.
