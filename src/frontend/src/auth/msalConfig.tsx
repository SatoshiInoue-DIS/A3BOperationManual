import { PublicClientApplication, Configuration, LogLevel } from "@azure/msal-browser";

const msalConfig: Configuration = {
    auth: {
        clientId: import.meta.env.VITE_CLIENT_ID,
        authority: import.meta.env.VITE_AUTHORITY,
        redirectUri: import.meta.env.VITE_REDIRECT_URI,
        navigateToLoginRequestUrl: false,
    },
    cache: {
        cacheLocation: "sessionStorage", // This configures where your cache will be stored
        storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
    },
    system: {
        allowNativeBroker: false, // Disables WAM Broker
        // loggerOptions: {
        //     loggerCallback: (level, message, containsPii) => {
        //         if (containsPii) {
        //             return;
        //         }
        //         switch (level) {
        //             case LogLevel.Error:
        //                 console.error(message);
        //                 return;
        //             case LogLevel.Info:
        //                 console.info(message);
        //                 return;
        //             case LogLevel.Verbose:
        //                 console.debug(message);
        //                 return;
        //             case LogLevel.Warning:
        //                 console.warn(message);
        //                 return;
        //         }
        //     }
        // }
    }
};

export const msalInstance = new PublicClientApplication(msalConfig);

// export default msalConfig;
