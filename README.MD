## Local Demo

This branch is set up as a localhost upload demo. The upload server pretends to process a video for about 5 seconds, then returns infant `51` as the result.

Start the demo server from the repo root:

```bash
python3 demo_server.py
```

Then open:

```text
http://127.0.0.1:8000
```

For this demo branch, the frontend upload endpoint is hard-coded to:

```text
http://127.0.0.1:8000/api/infant-motion/upload
```

So the upload will only work while `demo_server.py` is running.

Upload any video file. The server will save it under `demo_uploads/`, wait briefly, then return:

```json
{
  "status": "complete",
  "subjectId": "51",
  "reconBase": "http://127.0.0.1:8000/output/app_reconstructions/"
}
```

The app will then load the motion viewer for infant `51`.

In this demo branch, the server-returned infant is treated as the abnormal/current infant. Every other subject folder under `output/app_reconstructions/` is treated as a normal reference. 

For the real server later, keep the same endpoint shape or update `DEFAULT_UPLOAD_ENDPOINT` in `app/app.js`.

## Real Server Contract

The frontend sends a `POST` request to `DEFAULT_UPLOAD_ENDPOINT`.

For the current demo branch, that endpoint is:

```text
http://127.0.0.1:8000/api/infant-motion/upload
```

The request body is `multipart/form-data` with one file field:

```text
video=<uploaded infant video file>
```

In JavaScript, the frontend sends it like this:

```js
formData.append("video", selectedUploadFile);
```

The server should receive that video, run the processing pipeline, write the output files into a public reconstruction folder, and return JSON.

### Immediate Complete Response

If the server waits until processing is finished before responding, return:

```json
{
  "status": "complete",
  "subjectId": "51",
  "reconBase": "http://127.0.0.1:8000/output/app_reconstructions/"
}
```

`subjectId` is the folder name for the newly processed infant. In this demo, that is always `51`.

`reconBase` is the public URL where the browser can load reconstruction folders. The app will load files such as:

```text
<reconBase>/<subjectId>/global_reconstruction.json
<reconBase>/<subjectId>/component_metadata.json
<reconBase>/<subjectId>/joint_percent_variance.json
<reconBase>/<subjectId>/components/component_0.json
```

### Async Processing Response

If processing takes longer, the upload endpoint can return:

```json
{
  "status": "processing",
  "statusUrl": "http://127.0.0.1:8000/api/infant-motion/jobs/demo-job-id"
}
```

The frontend will poll `statusUrl` until it receives a completed response:

```json
{
  "status": "complete",
  "subjectId": "51",
  "reconBase": "http://127.0.0.1:8000/output/app_reconstructions/"
}
```

If processing fails, return:

```json
{
  "status": "failed",
  "message": "Pose extraction failed."
}
```

### Required Output Folder Shape

For a processed infant, the server should expose:

```text
output/app_reconstructions/<subjectId>/
  component_metadata.json
  global_reconstruction.json
  joint_percent_variance.json
  components/
    component_0.json
    component_1.json
    ...
```

The uploaded/result infant is treated as the abnormal/current infant. Every other subject folder under `output/app_reconstructions/` is treated as a normal reference.
