# PGET Mock Exams

Two 100-MCQ mock exams built on the UHS PGET Table of Specifications:

- **Paper I**: Basic Medical Sciences (MBBS)
- **Paper II**: Obstetrics & Gynaecology (includes 11 attitude-domain questions)

This is a static site with no build step. Answers and progress are stored in the browser's localStorage.

## Publish on GitHub Pages

1. Create a repo (e.g. `pget-mock`) and push the contents of this folder to the root of `main`.
2. In the repo, go to **Settings → Pages**, choose **Deploy from a branch**, then select `main` and `/ (root)`.
3. The site will be live at `https://<username>.github.io/pget-mock/`.

## Files

- `index.html`: home page where you pick an exam
- `exam.html?exam=paper1` / `exam.html?exam=obgyn`: the exam, results and review screens
- `data/paper1.js`, `data/obgyn.js`: the question banks. Each question has its options, the correct answer index, an explanation and a "why wrong" note for every wrong option.
- `assets/`: the stylesheet and app logic
