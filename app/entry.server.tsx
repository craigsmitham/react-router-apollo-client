import { PassThrough } from "node:stream";

import type { AppLoadContext, EntryContext } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import type { RenderToPipeableStreamOptions } from "react-dom/server";
import { renderToPipeableStream } from "react-dom/server";
import { ApolloClient, createHttpLink, InMemoryCache } from "@apollo/client";
import { getDataFromTree } from "@apollo/client/react/ssr";

export const streamTimeout = 5_000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: AppLoadContext
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    let userAgent = request.headers.get("user-agent");

    // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
    // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
    let readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode
        ? "onAllReady"
        : "onShellReady";

    const client = new ApolloClient({
      ssrMode: true,
      cache: new InMemoryCache(),
      link: createHttpLink({
        uri: "https://flyby-gateway.herokuapp.com/", // from Apollo's Voyage tutorial series (https://www.apollographql.com/tutorials/voyage-part1/)
        headers: Object.fromEntries(request.headers.entries()),
        credentials: request.credentials ?? "include", // or "same-origin" if your backend server is the same domain
      }),
    });

    const App = <ServerRouter context={routerContext} url={request.url} />;

    return getDataFromTree(App).then(() => {
      const initialState = client.extract();
      const { pipe, abort } = renderToPipeableStream(
        <>
          {App}
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__APOLLO_STATE__=${JSON.stringify(
                initialState
              ).replace(/</g, "\\u003c")}`, // The replace call escapes the < character to prevent cross-site scripting attacks that are possible via the presence of </script> in a string literal
            }}
          />
        </>,
        {
          [readyOption]() {
            shellRendered = true;
            const body = new PassThrough();
            const stream = createReadableStreamFromReadable(body);

            responseHeaders.set("Content-Type", "text/html");

            resolve(
              new Response(stream, {
                headers: responseHeaders,
                status: responseStatusCode,
              })
            );

            pipe(body);
          },
          onShellError(error: unknown) {
            reject(error);
          },
          onError(error: unknown) {
            responseStatusCode = 500;
            // Log streaming rendering errors from inside the shell.  Don't log
            // errors encountered during initial shell rendering since they'll
            // reject and get logged in handleDocumentRequest.
            if (shellRendered) {
              console.error(error);
            }
          },
        }
      );

      // Abort the rendering stream after the `streamTimeout` so it has tine to
      // flush down the rejected boundaries
      setTimeout(abort, streamTimeout + 1000);
    });
  });
}
