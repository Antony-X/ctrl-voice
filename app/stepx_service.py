# Step-Audio-EditX tone/style editor (14 emotions, 32 speaking styles). Usage: python stepx_service.py <port>
# Everything lives in main(): Step-Audio-EditX starts vLLM worker processes that re-import this file.
import os, sys, time, uuid


def main():
    import soundfile as sf, uvicorn
    from fastapi import FastAPI
    port = int(sys.argv[1]); gen = "/workspace/app_data/gen"; os.makedirs(gen, exist_ok=True)
    os.chdir("/workspace/repos/Step-Audio-EditX"); sys.path.insert(0, "/workspace/repos/Step-Audio-EditX")
    import tts_infer
    sys.argv = ["stepx", "--model-path", "/workspace/models/Step-Audio-EditX", "--tokenizer-path", "/workspace/models/Step-Audio-Tokenizer",
                "--model-source", "local", "--gpu-memory-utilization", os.environ.get("STEPX_GPU", "0.16")]
    sx = tts_infer.load_model(tts_infer.get_args())
    app = FastAPI()

    @app.post("/instruct")
    def instruct(r: dict):
        t = time.time(); p = r["path"]
        for _ in range(int(r.get("iters", 1))):  # iterative editing strengthens the style
            a, sr = sx.edit(prompt_wav_path=p, prompt_text=r["text"], edit_type=r["edit_type"], edit_info=r.get("edit_info", ""))
            p = f"{gen}/stepx_{uuid.uuid4().hex[:10]}.wav"; sf.write(p, a.detach().float().cpu().squeeze().numpy(), sr)
        return dict(path=p, sr=sr, sec=time.time() - t)

    @app.get("/health")
    def health(): return dict(ok=True, model="stepx")

    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    main()
