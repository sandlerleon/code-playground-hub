# AI Trainer — User Prompts

This file collects the prompts and follow-up requests used to build the AI Trainer / Code Playground app.

---

## 1. Initial request

> finish this app and publish to my connected github project ai-trainer
> https://github.com/sandlerleon/ai-trainer-app
> I like to use 10 most popular languges, use similar ui and multi user/login features like this website, allow codes like codepans
> https://dpoker.lovable.app/

## 2. Architecture clarifications

- **Backend**: Yes, use Lovable Cloud
- **Code execution**: Use public Piston API (emkc.org) for all 10 languages
- **GitHub**: Yes, build now — I'll connect GitHub myself

## 3. Build error fix

> For the code present, I get the error below.
> Please think step-by-step in order to resolve it.
> `build failed with exit status 1: ... er/node_modules/vite/node_modules/rolldown/dist/shared/rolldown-build-CrPk_lZe.mjs:41:3)`

## 4. GitHub setup questions

> how to push code to my github
> create new epo in my github
> push to this https://github.com/sandlerleon/code-playground-hub.git
> Enable me to connect my app to an existing GitHub repository and push updates to it automatically.
> **Repo preference**: New Lovable repo

## 5. Code execution migration

> error when i click run button Piston error 401: {"message":"Public Piston API is now whitelist only as of 2/15/2026. ..."}
> Implement Judge0 execution using my RapidAPI key and make the run button work across the 10 languages.

## 6. Judge0 fix

> Judge0 error 403: {"message":"You are not subscribed to this API."}

## 7. Switch to Gemini for execution

> can you use gemini api instead

## 8. Janeway AI teacher

> can you add gemini teacher who will interact with user via chat window and give them step by step instructions, feedback and will have upbeat, optimist personality, use Janeway character from computer on StarTrek Prodigy protostar
> save in sqllite on filesystem
> browser localstorage

## 9. Voice for Janeway

> also play janeway replies via speaker try to use her voice, allow user to tolk to her via mike

## 10. Curriculum, push-to-talk, autoplay

> add clickable currculum as a table of contexts expandable menu link, add push to talk, auto play janeway voice comment when page first loads last comment

## 11. GitHub repo link footer

> show github repository link footer

## 12. Microphone access note

> Microphone access is required to talk to Janeway.

## 13. Prompts README in footer

> show all promots given to mkae tis app in footer link to readme text file in github
