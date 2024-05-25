import express from "express";
import streamToBuffer from "stream-to-buffer";
import { SparqlEndpointFetcher } from "fetch-sparql-endpoint";
const app = express();

export const startServer = async (settings?: Record<string, string>) => {
  const lpfEndpoint = settings?.["lpfEndpoint"] ?? "http://localhost:3002";
  const endpoint = settings?.["sparqlEndpoint"] ?? "http://localhost:3030/ds";
  const [_, __, port] = lpfEndpoint.split(":");
  app.listen(port, () => {
    console.log(`ldf Server running on port ${port}`);
  });

  const myFetcher = new SparqlEndpointFetcher();

  const prefixes =
    settings?.["prefixes"] ??
    `
    PREFIX : <http://senforsce.com/o8/brain/>
    PREFIX sen: <http://senforsce.com/o8/brain/>
    PREFIX sc: <http://senforsce.com/o8/brain/SecureConfig/>
    PREFIX se: <http://senforsce.com/o8/brain/SecureEnvironment/>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX xml: <http://www.w3.org/XML/1998/namespace>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    PREFIX i18n: <http://senforsce.com/o8/brain/i18n/>
    PREFIX path: <http://senforsce.com/o8/brain/path/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    `;

  app.get("/", (_, res) => {
    res.send("Hello World!");
  });

  app.get("/info", (req, res) => {
    (async () => {
      console.log("info is called");

      const bindingsStream = await myFetcher.fetchBindings(
        endpoint,
        `${prefixes} SELECT * WHERE { ?s ?p ?o } LIMIT 100`
      );
      bindingsStream.on("data", (bindings) => res.json(bindings));
    })();
  });

  app.get("/subject/:subject", async (req, res) => {
    const subject = req.params.subject;

    console.log(`subject ${subject} is called`);

    try {
      // Fetch bindings
      const streamServer = await myFetcher.fetchBindings(
        endpoint,
        `${prefixes} SELECT * WHERE { ${subject} ?p ?o }`
      );

      streamServer.on("data", (stream) => {
        // Convert stream to buffer, send first iteral for now
        console.log(stream);
        if (stream.o?.termType === "Literal") res.send(stream);
      });
    } catch (error) {
      console.error("Error fetching bindings:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  app.get("/subject-predicate/:subject/:predicate", async (req, res) => {
    const subject = req.params.subject;
    const predicate = req.params.predicate;

    try {
      // Fetch bindings
      const streamServer = await myFetcher.fetchBindings(
        endpoint,
        `${prefixes} SELECT * WHERE { ${subject} ${predicate} ?o }`
      );

      streamServer.on("data", (stream) => {
        // Convert stream to buffer
        streamToBuffer(stream, (err: any, buffer: { toString: () => any }) => {
          if (err) {
            console.error("Error converting stream to buffer:", err);
            res.status(500).send("Internal Server Error");
          } else {
            // Send buffer as response
            res.send(buffer.toString());
          }
        });
      });
    } catch (error) {
      console.error("Error fetching bindings:", error);
      res.status(500).send("Internal Server Error");
    }
  });
};
