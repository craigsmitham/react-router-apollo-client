This is a minimal repro of a react-router v7 encountering issues with using Apollo Client.

This repro case was created by:
1. Creating a new react-router app `npx create-react-router@latest react-router-apollo-client`
2. Revealing the server entry point  by running `npx react-router reveal`
3. Updating revealed server entry point `entry.server.tsx` based on guidance for Remix in https://www.apollographql.com/blog/how-to-use-apollo-client-with-remix

To reproduce the issue, simply run `npm run dev` and visit dev server http://localhost:5173 and observe the following error:

```
Unexpected Server Error

TypeError [ERR_INVALID_STATE]: Invalid state: ReadableStream is locked
```

More information: 

This error appears to be triggered when the `getDataFromTree(App)` line is called: https://github.com/craigsmitham/react-router-apollo-client/blob/1cb7514b7403a456bc141ef1e5b658e1cfb13b91/app/entry.server.tsx#L44C1-L44C32

GH issue: 

