/**
* Unit tests for Orator Static Server
*
* Tests the static file serving capabilities of the Orator module through a
* real Restify HTTP server, exercising the full serving pipeline including
* MIME type detection, route stripping, default files, and custom configuration.
*
* @license     MIT
*
* @author      Steven Velozo <steven@velozo.com>
*/

const libOratorStaticServer = require('../source/Orator-Static-Server.js');
const libOrator = require('orator');
const libOratorServiceServerRestify = require('orator-serviceserver-restify');

const Chai = require("chai");
const Expect = Chai.expect;

const libFable = require('fable');
const libPath = require('path');
const libHTTP = require('http');

const _StaticContentPath = libPath.normalize(__dirname + '/static_content/');

// Port counter for Restify test servers to avoid collisions
let _NextTestPort = 20100;
function getNextTestPort()
{
	return _NextTestPort++;
}

/**
 * Create a Fable/Orator/Restify harness for testing.
 *
 * @param {number} pPort - The port for the Restify server.
 * @returns {Object} Harness with fable, orator, restifyServer, and staticServer references.
 */
function createHarness(pPort)
{
	let tmpFable = new libFable(
		{
			Product: 'StaticServerTests',
			ProductVersion: '0.0.0',
			APIServerPort: pPort
		});

	// FilePersistence is needed for subdomain magic subfolder check
	tmpFable.serviceManager.instantiateServiceProvider('FilePersistence');
	tmpFable.serviceManager.addServiceType('Orator', libOrator);
	tmpFable.serviceManager.addServiceType('OratorServiceServer', libOratorServiceServerRestify);
	tmpFable.serviceManager.addServiceType('OratorStaticServer', libOratorStaticServer);

	let tmpOrator = tmpFable.serviceManager.instantiateServiceProvider('Orator', {});
	let tmpRestifyServer = tmpFable.serviceManager.instantiateServiceProvider('OratorServiceServer', {});
	let tmpStaticServer = tmpFable.serviceManager.instantiateServiceProvider('OratorStaticServer', {});

	return (
		{
			fable: tmpFable,
			orator: tmpOrator,
			restifyServer: tmpRestifyServer,
			staticServer: tmpStaticServer
		});
}

/**
 * Start the Orator service and call back.
 */
function startHarness(pHarness, fCallback)
{
	pHarness.orator.startService(
		(pError) =>
		{
			return fCallback(pError, pHarness);
		});
}

/**
 * Make an HTTP GET request and collect the response.
 *
 * @param {number} pPort - Port to connect to.
 * @param {string} pPath - URL path to request.
 * @param {Function} fCallback - Called with (error, statusCode, headers, body).
 * @param {Object} [pHeaders] - Optional extra headers for the request.
 */
function makeRequest(pPort, pPath, fCallback, pHeaders)
{
	let tmpOptions = (
		{
			hostname: 'localhost',
			port: pPort,
			path: pPath,
			method: 'GET',
			headers: Object.assign({}, pHeaders || {})
		});

	let tmpRequest = libHTTP.request(tmpOptions,
		(pResponse) =>
		{
			let tmpData = '';
			pResponse.on('data',
				(pChunk) =>
				{
					tmpData += pChunk;
				});
			pResponse.on('end',
				() =>
				{
					return fCallback(null, pResponse.statusCode, pResponse.headers, tmpData);
				});
		});

	tmpRequest.on('error',
		(pError) =>
		{
			return fCallback(pError);
		});

	tmpRequest.end();
}

suite
(
	'Orator Static Server',
	() =>
	{
		suite
		(
			'Object Sanity',
			() =>
			{
				test
				(
					'the static server module should initialize as a proper object',
					(fDone) =>
					{
						let tmpFable = new libFable({Product:'StaticServerTests', ProductVersion:'0.0.0'});
						tmpFable.serviceManager.addServiceType('OratorStaticServer', libOratorStaticServer);
						let tmpStaticServer = tmpFable.serviceManager.instantiateServiceProvider('OratorStaticServer', {});

						Expect(tmpStaticServer).to.be.an('object');
						Expect(tmpStaticServer.serviceType).to.equal('OratorStaticServer');
						Expect(tmpStaticServer.routes).to.be.an('array');
						Expect(tmpStaticServer.routes).to.have.lengthOf(0);
						Expect(tmpStaticServer.addStaticRoute).to.be.a('function');
						return fDone();
					}
				);

				test
				(
					'addStaticRoute should return false when no Orator instance is registered',
					(fDone) =>
					{
						let tmpFable = new libFable({Product:'StaticServerTests', ProductVersion:'0.0.0'});
						tmpFable.serviceManager.addServiceType('OratorStaticServer', libOratorStaticServer);
						let tmpStaticServer = tmpFable.serviceManager.instantiateServiceProvider('OratorStaticServer', {});

						let tmpResult = tmpStaticServer.addStaticRoute(_StaticContentPath);
						Expect(tmpResult).to.equal(false);
						Expect(tmpStaticServer.routes).to.have.lengthOf(0);
						return fDone();
					}
				);

				test
				(
					'addStaticRoute should track registered routes',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								Expect(pError).to.equal(undefined);

								let tmpResult = tmpHarness.staticServer.addStaticRoute(_StaticContentPath, 'index.html', '/content/*', '/content/');
								Expect(tmpResult).to.equal(true);
								Expect(tmpHarness.staticServer.routes).to.have.lengthOf(1);
								Expect(tmpHarness.staticServer.routes[0].filePath).to.equal(_StaticContentPath);
								Expect(tmpHarness.staticServer.routes[0].defaultFile).to.equal('index.html');
								Expect(tmpHarness.staticServer.routes[0].route).to.equal('/content/*');
								Expect(tmpHarness.staticServer.routes[0].routeStrip).to.equal('/content/');

								tmpHarness.orator.stopService(
									() =>
									{
										return fDone();
									});
							});
					}
				);
			}
		);

		suite
		(
			'Serving HTML Files via Restify',
			() =>
			{
				test
				(
					'should serve index.html with correct content and content-type',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								tmpHarness.orator.addStaticRoute(_StaticContentPath, 'index.html', '/static/*', '/static/');

								makeRequest(tmpPort, '/static/index.html',
									(pError, pStatusCode, pHeaders, pBody) =>
									{
										Expect(pError).to.equal(null);
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.contain('Test Index');
										Expect(pBody).to.contain('Welcome to the test server');
										tmpHarness.orator.log.info(`Served index.html: status=${pStatusCode}`);
										tmpHarness.orator.stopService(
											() =>
											{
												return fDone();
											});
									});
							});
					}
				);

				test
				(
					'should serve about.html with correct content',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								tmpHarness.orator.addStaticRoute(_StaticContentPath, 'index.html', '/pages/*', '/pages/');

								makeRequest(tmpPort, '/pages/about.html',
									(pError, pStatusCode, pHeaders, pBody) =>
									{
										Expect(pError).to.equal(null);
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.contain('About');
										Expect(pBody).to.contain('About page content');
										tmpHarness.orator.log.info(`Served about.html: status=${pStatusCode}`);
										tmpHarness.orator.stopService(
											() =>
											{
												return fDone();
											});
									});
							});
					}
				);

				test
				(
					'should serve the default file when requesting a directory path',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								tmpHarness.orator.addStaticRoute(_StaticContentPath, 'index.html', '/site/*', '/site/');

								makeRequest(tmpPort, '/site/',
									(pError, pStatusCode, pHeaders, pBody) =>
									{
										Expect(pError).to.equal(null);
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.contain('Test Index');
										tmpHarness.orator.log.info(`Served default file at /site/: status=${pStatusCode}`);
										tmpHarness.orator.stopService(
											() =>
											{
												return fDone();
											});
									});
							});
					}
				);

				test
				(
					'should serve a custom default file when specified',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								tmpHarness.orator.addStaticRoute(_StaticContentPath, 'about.html', '/alt/*', '/alt/');

								makeRequest(tmpPort, '/alt/',
									(pError, pStatusCode, pHeaders, pBody) =>
									{
										Expect(pError).to.equal(null);
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.contain('About page content');
										tmpHarness.orator.log.info(`Custom default about.html: status=${pStatusCode}`);
										tmpHarness.orator.stopService(
											() =>
											{
												return fDone();
											});
									});
							});
					}
				);
			}
		);

		suite
		(
			'Serving CSS, JSON, and JavaScript Files',
			() =>
			{
				test
				(
					'should serve CSS with correct content-type',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								tmpHarness.orator.addStaticRoute(_StaticContentPath, 'index.html', '/assets/*', '/assets/');

								makeRequest(tmpPort, '/assets/style.css',
									(pError, pStatusCode, pHeaders, pBody) =>
									{
										Expect(pError).to.equal(null);
										Expect(pStatusCode).to.equal(200);
										Expect(pHeaders['content-type']).to.contain('text/css');
										Expect(pBody).to.contain('font-family');
										Expect(pBody).to.contain('sans-serif');
										tmpHarness.orator.log.info(`Served style.css: content-type=${pHeaders['content-type']}`);
										tmpHarness.orator.stopService(
											() =>
											{
												return fDone();
											});
									});
							});
					}
				);

				test
				(
					'should serve JSON with correct content-type and parseable content',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								tmpHarness.orator.addStaticRoute(_StaticContentPath, 'index.html', '/data/*', '/data/');

								makeRequest(tmpPort, '/data/data.json',
									(pError, pStatusCode, pHeaders, pBody) =>
									{
										Expect(pError).to.equal(null);
										Expect(pStatusCode).to.equal(200);
										Expect(pHeaders['content-type']).to.contain('application/json');
										let tmpParsed = JSON.parse(pBody);
										Expect(tmpParsed.TestKey).to.equal('TestValue');
										Expect(tmpParsed.Numbers).to.be.an('array');
										Expect(tmpParsed.Numbers).to.have.lengthOf(3);
										tmpHarness.orator.log.info(`Served data.json: parsed TestKey=${tmpParsed.TestKey}`);
										tmpHarness.orator.stopService(
											() =>
											{
												return fDone();
											});
									});
							});
					}
				);

				test
				(
					'should serve JavaScript with correct content-type',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								tmpHarness.orator.addStaticRoute(_StaticContentPath, 'index.html', '/js/*', '/js/');

								makeRequest(tmpPort, '/js/app.js',
									(pError, pStatusCode, pHeaders, pBody) =>
									{
										Expect(pError).to.equal(null);
										Expect(pStatusCode).to.equal(200);
										Expect(pHeaders['content-type']).to.contain('application/javascript');
										Expect(pBody).to.contain('Hello from the test app');
										tmpHarness.orator.log.info(`Served app.js: content-type=${pHeaders['content-type']}`);
										tmpHarness.orator.stopService(
											() =>
											{
												return fDone();
											});
									});
							});
					}
				);
			}
		);

		suite
		(
			'Route Stripping',
			() =>
			{
				test
				(
					'should strip the route prefix and serve the correct file',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								tmpHarness.orator.addStaticRoute(_StaticContentPath, 'index.html', '/public/*', '/public/');

								makeRequest(tmpPort, '/public/style.css',
									(pError, pStatusCode, pHeaders, pBody) =>
									{
										Expect(pError).to.equal(null);
										Expect(pStatusCode).to.equal(200);
										Expect(pHeaders['content-type']).to.contain('text/css');
										Expect(pBody).to.contain('font-family');
										tmpHarness.orator.log.info('Route /public/style.css stripped and served');
										tmpHarness.orator.stopService(
											() =>
											{
												return fDone();
											});
									});
							});
					}
				);

				test
				(
					'should serve JSON through a deep stripped route',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								tmpHarness.orator.addStaticRoute(_StaticContentPath, 'index.html', '/api/v1/static/*', '/api/v1/static/');

								makeRequest(tmpPort, '/api/v1/static/data.json',
									(pError, pStatusCode, pHeaders, pBody) =>
									{
										Expect(pError).to.equal(null);
										Expect(pStatusCode).to.equal(200);
										let tmpParsed = JSON.parse(pBody);
										Expect(tmpParsed.TestKey).to.equal('TestValue');
										tmpHarness.orator.log.info('Deep route /api/v1/static/data.json stripped and served');
										tmpHarness.orator.stopService(
											() =>
											{
												return fDone();
											});
									});
							});
					}
				);
			}
		);

		suite
		(
			'Missing Files and Error Handling',
			() =>
			{
				test
				(
					'should return 404 for a file that does not exist',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								tmpHarness.orator.addStaticRoute(_StaticContentPath, 'index.html', '/files/*', '/files/');

								makeRequest(tmpPort, '/files/does-not-exist.html',
									(pError, pStatusCode, pHeaders, pBody) =>
									{
										Expect(pError).to.equal(null);
										Expect(pStatusCode).to.equal(404);
										tmpHarness.orator.log.info(`Missing file returned ${pStatusCode}`);
										tmpHarness.orator.stopService(
											() =>
											{
												return fDone();
											});
									});
							});
					}
				);

				test
				(
					'should return an error status for path traversal attempts',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								tmpHarness.orator.addStaticRoute(_StaticContentPath, 'index.html', '/safe/*', '/safe/');

								makeRequest(tmpPort, '/safe/../../../etc/passwd',
									(pError, pStatusCode, pHeaders, pBody) =>
									{
										Expect(pError).to.equal(null);
										// serve-static should prevent path traversal
										Expect(pStatusCode).to.be.oneOf([400, 403, 404]);
										tmpHarness.orator.log.info(`Path traversal blocked with status ${pStatusCode}`);
										tmpHarness.orator.stopService(
											() =>
											{
												return fDone();
											});
									});
							});
					}
				);

				test
				(
					'addStaticRoute should reject non-string file paths',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								Expect(tmpHarness.orator.addStaticRoute()).to.equal(false);
								Expect(tmpHarness.orator.addStaticRoute(null)).to.equal(false);
								Expect(tmpHarness.orator.addStaticRoute(42)).to.equal(false);
								Expect(tmpHarness.orator.addStaticRoute({})).to.equal(false);
								Expect(tmpHarness.orator.addStaticRoute(true)).to.equal(false);
								tmpHarness.orator.log.info('All non-string file paths rejected');
								tmpHarness.orator.stopService(
									() =>
									{
										return fDone();
									});
							});
					}
				);
			}
		);

		suite
		(
			'Response Headers',
			() =>
			{
				test
				(
					'should include standard caching headers (ETag, Last-Modified)',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								tmpHarness.orator.addStaticRoute(_StaticContentPath, 'index.html', '/headers/*', '/headers/');

								makeRequest(tmpPort, '/headers/index.html',
									(pError, pStatusCode, pHeaders, pBody) =>
									{
										Expect(pError).to.equal(null);
										Expect(pStatusCode).to.equal(200);
										Expect(pHeaders).to.have.a.property('etag');
										Expect(pHeaders).to.have.a.property('last-modified');
										Expect(pHeaders).to.have.a.property('content-length');
										tmpHarness.orator.log.info(`Headers: etag=${pHeaders['etag']} last-modified=${pHeaders['last-modified']}`);
										tmpHarness.orator.stopService(
											() =>
											{
												return fDone();
											});
									});
							});
					}
				);

				test
				(
					'should apply custom serve-static params like maxAge',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								tmpHarness.orator.addStaticRoute(_StaticContentPath, 'index.html', '/cached/*', '/cached/', {maxAge: 86400000});

								makeRequest(tmpPort, '/cached/style.css',
									(pError, pStatusCode, pHeaders, pBody) =>
									{
										Expect(pError).to.equal(null);
										Expect(pStatusCode).to.equal(200);
										Expect(pHeaders['cache-control']).to.contain('max-age=86400');
										tmpHarness.orator.log.info(`Cache-control: ${pHeaders['cache-control']}`);
										tmpHarness.orator.stopService(
											() =>
											{
												return fDone();
											});
									});
							});
					}
				);
			}
		);

		suite
		(
			'Query String Handling',
			() =>
			{
				test
				(
					'should strip query strings from URLs before serving',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								tmpHarness.orator.addStaticRoute(_StaticContentPath, 'index.html', '/qs/*', '/qs/');

								makeRequest(tmpPort, '/qs/style.css?v=1.0.0&bust=true',
									(pError, pStatusCode, pHeaders, pBody) =>
									{
										Expect(pError).to.equal(null);
										Expect(pStatusCode).to.equal(200);
										Expect(pHeaders['content-type']).to.contain('text/css');
										Expect(pBody).to.contain('font-family');
										tmpHarness.orator.log.info('Query string stripped, file served correctly');
										tmpHarness.orator.stopService(
											() =>
											{
												return fDone();
											});
									});
							});
					}
				);
			}
		);

		suite
		(
			'Subdirectory Access',
			() =>
			{
				test
				(
					'should serve files from a subdirectory path',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								tmpHarness.orator.addStaticRoute(_StaticContentPath, 'index.html', '/sub/*', '/sub/');

								makeRequest(tmpPort, '/sub/subsite/index.html',
									(pError, pStatusCode, pHeaders, pBody) =>
									{
										Expect(pError).to.equal(null);
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.contain('Subsite');
										Expect(pBody).to.contain('Subsite index page');
										tmpHarness.orator.log.info('Subsite file served from subdirectory');
										tmpHarness.orator.stopService(
											() =>
											{
												return fDone();
											});
									});
							});
					}
				);
			}
		);

		suite
		(
			'Multiple Static Routes',
			() =>
			{
				test
				(
					'should register and serve from multiple static route prefixes',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								let tmpSubsitePath = libPath.normalize(__dirname + '/static_content/subsite/');

								tmpHarness.orator.addStaticRoute(_StaticContentPath, 'index.html', '/main/*', '/main/');
								tmpHarness.orator.addStaticRoute(tmpSubsitePath, 'index.html', '/portal/*', '/portal/');

								tmpHarness.fable.Utility.waterfall([
										(fStageComplete) =>
										{
											makeRequest(tmpPort, '/main/data.json',
												(pError, pStatusCode, pHeaders, pBody) =>
												{
													Expect(pStatusCode).to.equal(200);
													let tmpParsed = JSON.parse(pBody);
													Expect(tmpParsed.TestKey).to.equal('TestValue');
													tmpHarness.orator.log.info('Route /main/ served data.json');
													return fStageComplete();
												});
										},
										(fStageComplete) =>
										{
											makeRequest(tmpPort, '/portal/',
												(pError, pStatusCode, pHeaders, pBody) =>
												{
													Expect(pStatusCode).to.equal(200);
													Expect(pBody).to.contain('Subsite');
													tmpHarness.orator.log.info('Route /portal/ served subsite index');
													return fStageComplete();
												});
										}
									],
									(pError) =>
									{
										tmpHarness.orator.stopService(
											() =>
											{
												return fDone();
											});
									});
							});
					}
				);
			}
		);

		suite
		(
			'Static Routes Alongside API Routes',
			() =>
			{
				test
				(
					'should serve both API and static routes on the same server',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								// Register an API route first
								tmpHarness.orator.serviceServer.get('/api/status',
									(pRequest, pResponse, fNext) =>
									{
										pResponse.send({status: 'ok', version: '1.0.0'});
										return fNext();
									});

								// Then register static serving on a different path
								tmpHarness.orator.addStaticRoute(_StaticContentPath, 'index.html', '/app/*', '/app/');

								tmpHarness.fable.Utility.waterfall([
										(fStageComplete) =>
										{
											// API route should work
											makeRequest(tmpPort, '/api/status',
												(pError, pStatusCode, pHeaders, pBody) =>
												{
													Expect(pStatusCode).to.equal(200);
													let tmpParsed = JSON.parse(pBody);
													Expect(tmpParsed.status).to.equal('ok');
													Expect(tmpParsed.version).to.equal('1.0.0');
													tmpHarness.orator.log.info('API route /api/status responded');
													return fStageComplete();
												});
										},
										(fStageComplete) =>
										{
											// Static route should also work
											makeRequest(tmpPort, '/app/style.css',
												(pError, pStatusCode, pHeaders, pBody) =>
												{
													Expect(pStatusCode).to.equal(200);
													Expect(pHeaders['content-type']).to.contain('text/css');
													Expect(pBody).to.contain('font-family');
													tmpHarness.orator.log.info('Static route /app/style.css served');
													return fStageComplete();
												});
										}
									],
									(pError) =>
									{
										tmpHarness.orator.stopService(
											() =>
											{
												return fDone();
											});
									});
							});
					}
				);
			}
		);

		suite
		(
			'OratorStaticServer Service Provider',
			() =>
			{
				test
				(
					'should serve files when addStaticRoute is called through the service provider',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								let tmpResult = tmpHarness.staticServer.addStaticRoute(_StaticContentPath, 'index.html', '/svc/*', '/svc/');
								Expect(tmpResult).to.equal(true);
								Expect(tmpHarness.staticServer.routes).to.have.lengthOf(1);

								makeRequest(tmpPort, '/svc/data.json',
									(pError, pStatusCode, pHeaders, pBody) =>
									{
										Expect(pError).to.equal(null);
										Expect(pStatusCode).to.equal(200);
										let tmpParsed = JSON.parse(pBody);
										Expect(tmpParsed.TestKey).to.equal('TestValue');
										tmpHarness.orator.log.info('Service provider addStaticRoute served data.json');
										tmpHarness.orator.stopService(
											() =>
											{
												return fDone();
											});
									});
							});
					}
				);

				test
				(
					'should track multiple routes through the service provider',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								let tmpSubsitePath = libPath.normalize(__dirname + '/static_content/subsite/');

								tmpHarness.staticServer.addStaticRoute(_StaticContentPath, 'index.html', '/a/*', '/a/');
								tmpHarness.staticServer.addStaticRoute(tmpSubsitePath, 'index.html', '/b/*', '/b/');

								Expect(tmpHarness.staticServer.routes).to.have.lengthOf(2);
								Expect(tmpHarness.staticServer.routes[0].route).to.equal('/a/*');
								Expect(tmpHarness.staticServer.routes[1].route).to.equal('/b/*');

								tmpHarness.orator.stopService(
									() =>
									{
										return fDone();
									});
							});
					}
				);

				test
				(
					'should not track routes when addStaticRoute fails',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								let tmpResult = tmpHarness.staticServer.addStaticRoute(42);
								Expect(tmpResult).to.equal(false);
								Expect(tmpHarness.staticServer.routes).to.have.lengthOf(0);

								tmpHarness.orator.stopService(
									() =>
									{
										return fDone();
									});
							});
					}
				);
			}
		);

		suite
		(
			'MIME Type Detection via setMimeHeader',
			() =>
			{
				test
				(
					'should detect common MIME types correctly',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								let tmpCapturedHeaders = {};
								let tmpMockResponse = { setHeader: function(pName, pValue) { tmpCapturedHeaders[pName] = pValue; } };

								tmpHarness.orator.setMimeHeader('test.html', tmpMockResponse);
								Expect(tmpCapturedHeaders['Content-Type']).to.equal('text/html');

								tmpHarness.orator.setMimeHeader('test.css', tmpMockResponse);
								Expect(tmpCapturedHeaders['Content-Type']).to.equal('text/css');

								tmpHarness.orator.setMimeHeader('test.json', tmpMockResponse);
								Expect(tmpCapturedHeaders['Content-Type']).to.equal('application/json');

								tmpHarness.orator.setMimeHeader('test.js', tmpMockResponse);
								Expect(tmpCapturedHeaders['Content-Type']).to.equal('application/javascript');

								tmpHarness.orator.setMimeHeader('test.png', tmpMockResponse);
								Expect(tmpCapturedHeaders['Content-Type']).to.equal('image/png');

								tmpHarness.orator.setMimeHeader('test.jpg', tmpMockResponse);
								Expect(tmpCapturedHeaders['Content-Type']).to.equal('image/jpeg');

								tmpHarness.orator.setMimeHeader('test.svg', tmpMockResponse);
								Expect(tmpCapturedHeaders['Content-Type']).to.equal('image/svg+xml');

								tmpHarness.orator.setMimeHeader('test.pdf', tmpMockResponse);
								Expect(tmpCapturedHeaders['Content-Type']).to.equal('application/pdf');

								tmpHarness.orator.setMimeHeader('test.txt', tmpMockResponse);
								Expect(tmpCapturedHeaders['Content-Type']).to.equal('text/plain');

								tmpHarness.orator.log.info('All common MIME types detected correctly');
								tmpHarness.orator.stopService(
									() =>
									{
										return fDone();
									});
							});
					}
				);

				test
				(
					'should fall back to application/octet-stream for unknown extensions',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								let tmpCapturedHeaders = {};
								let tmpMockResponse = { setHeader: function(pName, pValue) { tmpCapturedHeaders[pName] = pValue; } };

								tmpHarness.orator.setMimeHeader('mystery.xyz123', tmpMockResponse);
								Expect(tmpCapturedHeaders['Content-Type']).to.equal('application/octet-stream');

								tmpHarness.orator.setMimeHeader('noextension', tmpMockResponse);
								Expect(tmpCapturedHeaders['Content-Type']).to.equal('application/octet-stream');

								tmpHarness.orator.log.info('Unknown extensions fall back to octet-stream');
								tmpHarness.orator.stopService(
									() =>
									{
										return fDone();
									});
							});
					}
				);

				test
				(
					'should detect MIME types from paths with directories',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								let tmpCapturedHeaders = {};
								let tmpMockResponse = { setHeader: function(pName, pValue) { tmpCapturedHeaders[pName] = pValue; } };

								tmpHarness.orator.setMimeHeader('/assets/css/main.css', tmpMockResponse);
								Expect(tmpCapturedHeaders['Content-Type']).to.equal('text/css');

								tmpHarness.orator.setMimeHeader('/deep/path/image.png', tmpMockResponse);
								Expect(tmpCapturedHeaders['Content-Type']).to.equal('image/png');

								tmpHarness.orator.log.info('MIME types detected correctly from deep paths');
								tmpHarness.orator.stopService(
									() =>
									{
										return fDone();
									});
							});
					}
				);
			}
		);

		suite
		(
			'oldLibMime Compatibility Flag',
			() =>
			{
				test
				(
					'should correctly detect the mime library version',
					(fDone) =>
					{
						let tmpPort = getNextTestPort();
						let tmpHarness = createHarness(tmpPort);

						startHarness(tmpHarness,
							(pError) =>
							{
								Expect(tmpHarness.orator.oldLibMime).to.be.a('boolean');
								let libMime = require('mime');
								if ('lookup' in libMime)
								{
									Expect(tmpHarness.orator.oldLibMime).to.equal(true);
								}
								else
								{
									Expect(tmpHarness.orator.oldLibMime).to.equal(false);
								}
								tmpHarness.orator.log.info(`oldLibMime=${tmpHarness.orator.oldLibMime}`);
								tmpHarness.orator.stopService(
									() =>
									{
										return fDone();
									});
							});
					}
				);
			}
		);
	}
);
