import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Mesh, MeshBuilder, FreeCamera, Color4, StandardMaterial, Color3, PointLight, ShadowGenerator, Quaternion, Matrix, SceneLoader } from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, Control } from "@babylonjs/gui";
import { Environment } from "./environment";
import { Player } from "./characterController";
import { PlayerInput } from "./inputController";

enum State { START = 0, GAME = 1, LOSE = 2, CUTSCENE = 3 }

class App {
    // General Entire Application
    private _scene: Scene; // represents a scene to be rendered by the engine
    private _canvas: HTMLCanvasElement; // The canvas element is part of HTML5 and allows for dynamic, scriptable rendering of 2D shapes and bitmap images.
    private _engine: Engine; //The engine class is responsible for interfacing with all lower-level APIs such as WebGL and Audio

    //Game State Related variable declarations
    public assets;
    private _environment;
    private _player: Player;
    private _input: PlayerInput;


    //Scene - related variable declaration
    private _state: number = 0;
    private _gamescene: Scene;
    private _cutScene: Scene;

    constructor() {
        this._canvas = this._createCanvas();

        // initialize babylon scene and engine
        this._engine = new Engine(this._canvas);
        this._scene = new Scene(this._engine);

        // hide/show the Inspector
        window.addEventListener("keydown", (ev) => {
            // Shift+Ctrl+Alt+I
            if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
                if (this._scene.debugLayer.isVisible()) {
                    this._scene.debugLayer.hide();
                } else {
                    this._scene.debugLayer.show();
                }
            }
        });

        // run the main render loop
        this._main();
    }

    //method to hold the entire canvas creation
    private _createCanvas(): HTMLCanvasElement {


        //create the canvas html element and attach it to the webpage
        this._canvas = document.createElement("canvas");
        this._canvas.style.width = "100%";
        this._canvas.style.height = "100%";
        this._canvas.id = "gameCanvas";
        document.body.appendChild(this._canvas);

        return this._canvas;
    }

    private async _main(): Promise<void> {
        await this._goToStart();

        // Register a render loop to repeatedly render the scene
        //it doesn't work yet but it is supposed to switch between different states in the game
        //start menu, play cutcene, play actual game, game lost screen
        this._engine.runRenderLoop(() => {
            switch (this._state) {
                case State.START:
                    this._scene.render();
                    break;
                case State.CUTSCENE:
                    this._scene.render();
                    break;
                case State.GAME:
                    this._scene.render();
                    break;
                case State.LOSE:
                    this._scene.render();
                    break;
                default: break;
            }
        });

        //resize if the screen is resized/rotated
        window.addEventListener('resize', () => {
            this._engine.resize();
        });
    }
    //this method initiates the game start and shows loading screen until the game loads
    private async _goToStart(){
        this._engine.displayLoadingUI();

        //detaches all event handlers
        this._scene.detachControl();
        //variable to create a new scene
        let scene = new Scene(this._engine);
        scene.clearColor = new Color4(0,0,0,1);
        //var to hold instance of a free camera - just to show it works
        //later will be switched to Universal camera - which is an updated version of the Free camera
        //universal camera will provide more 'gaming' features like gamepad utilization
        let camera = new FreeCamera("camera1", new Vector3(0, 0, 0), scene);
        //defines what position the camera should look towards
        camera.setTarget(Vector3.Zero());

        //create a fullscreen ui for all of our GUI elements
        const guiMenu = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        guiMenu.idealHeight = 720; //fit our fullscreen ui to this height

        //create a simple button
        const startBtn = Button.CreateSimpleButton("start", "PLAY");
        startBtn.width = 0.2
        startBtn.height = "40px";
        startBtn.color = "white";
        startBtn.top = "-14px";
        startBtn.thickness = 0;
        startBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        guiMenu.addControl(startBtn);

        //this handles interactions with the start button attached to the scene
        startBtn.onPointerDownObservable.add(() => {
            this._goToCutScene();
            scene.detachControl(); //observables disabled
        });

        //SCENE FINISHED LOADING
        await scene.whenReadyAsync();
        this._engine.hideLoadingUI();
        //lastly set the current state to the start state and set the scene to the start scene
        this._scene.dispose();
        this._scene = scene;
        this._state = State.START;
    }

    //method for displaying the cutscene
    //currently we have no actual cutscene to display but this is needed so we implement the state switching
    private async _goToCutScene(): Promise<void> {
        this._engine.displayLoadingUI();
        //SETUP SCENE
        //dont detect any inputs from this ui while the game is loading
        this._scene.detachControl();
        this._cutScene = new Scene(this._engine);
        let camera = new FreeCamera("camera1", new Vector3(0, 0, 0), this._cutScene);
        camera.setTarget(Vector3.Zero());
        this._cutScene.clearColor = new Color4(0, 0, 0, 1);

         //GUI
         //Class used to create texture to support 2D GUI elements
         const cutScene = AdvancedDynamicTexture.CreateFullscreenUI("cutscene");

        //PROGRESS DIALOGUE 
        const next = Button.CreateSimpleButton("next", "NEXT");
        next.color = "white";
        next.thickness = 0;
        next.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        next.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        next.width = "64px";
        next.height = "64px";
        next.top = "-3%";
        next.left = "-12%";
        cutScene.addControl(next);

        next.onPointerUpObservable.add(() => {
            this._goToGame();
        })

        //--WHEN SCENE IS FINISHED LOADING--
        //this promise waits for the scene to finish loading
        await this._cutScene.whenReadyAsync();
        //hide the loading screen when done loading
        this._engine.hideLoadingUI();
        //release resources
        this._scene.dispose();
        //start the state for cutscene
        this._state = State.CUTSCENE;
        this._scene = this._cutScene;

        //--START LOADING AND SETTING UP THE GAME DURING THIS SCENE--
        var finishedLoading = false;

        await this._setUpGame().then(res =>{
            finishedLoading = true;
            this._goToGame();
        });
    }

    private async _setUpGame() {
        let scene = new Scene(this._engine);
        this._gamescene = scene;
    
        //--CREATE ENVIRONMENT--
        const environment = new Environment(scene);
        this._environment = environment;
        await this._environment.load(); //environment
        await this._loadCharacterAssets(scene);
    }

    private async _loadCharacterAssets(scene){

         async function loadCharacter(){
            //collision mesh
            const outer = MeshBuilder.CreateBox("outer", { width: 2, depth: 1, height: 3 }, scene);
            outer.isVisible = false;
            outer.isPickable = false;
            outer.checkCollisions = true;

            //move origin of box collider to the bottom of the mesh (to match player mesh)
            outer.bakeTransformIntoVertices(Matrix.Translation(0, 1.5, 0))

            //for collisions
            outer.ellipsoid = new Vector3(1, 1.5, 1);
            outer.ellipsoidOffset = new Vector3(0, 1.5, 0);

            // rotate the player mesh 180 since we want to see the back of the player
            outer.rotationQuaternion = new Quaternion(0, 1, 0, 0); 

            //MeshBuilder is a Babylon class for procedurally building meshes 
            //In the 3D virtual world shapes are built from meshes, lots of triangular facets joined 
            //together, each facet made from three vertices.
            var box = MeshBuilder.CreateBox("Small1", { width: 0.5, depth: 0.5, height: 0.25, faceColors: [new Color4(0,0,0,1), new Color4(0,0,0,1), new Color4(0,0,0,1), new Color4(0,0,0,1),new Color4(0,0,0,1), new Color4(0,0,0,1)] }, scene);
            box.position.y = 1.5;
            box.position.z = 1;

            
            //we are loading the predefined mesh of an imported 3D render
            return SceneLoader.ImportMeshAsync(null, "./models/", "player.glb", scene).then((result) =>{
                const root = result.meshes[0];
                //body is our actual player mesh
                const body = root;
                body.parent = outer;
                body.isPickable = false; //so our raycasts dont hit ourself
                body.getChildMeshes().forEach(m => {
                    m.isPickable = false;
                })
            
                return {
                    mesh: outer as Mesh,
                }
            });
        }

        //returns the all assets loaded for the UI of the character
        return loadCharacter().then(assets=> {
            this.assets = assets;
        })

    }

    private async _initializeGameAsync(scene): Promise<void> {
        //temporary light to light the entire scene
        var light0 = new HemisphericLight("HemiLight", new Vector3(0, 1, 0), scene);

        //for the ray cast that you see when the character moves and jumps
        const light = new PointLight("sparklight", new Vector3(0, 0, 0), scene);
        light.diffuse = new Color3(0.08627450980392157, 0.10980392156862745, 0.15294117647058825);
        light.intensity = 35;
        light.radius = 1;
    
        const shadowGenerator = new ShadowGenerator(1024, light);
        shadowGenerator.darkness = 0.4;
    
        //Create the player
        this._player = new Player(this.assets, scene, shadowGenerator, this._input);
        const camera = this._player.activatePlayerCamera();

    }

    private async _goToGame(){
        //--SETUP SCENE--
        this._scene.detachControl();
        let scene = this._gamescene;
        scene.clearColor = new Color4(0.01568627450980392, 0.01568627450980392, 0.20392156862745098); // a color that fit the overall color scheme better

        //--GUI--
        const playerUI = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        //dont detect any inputs from this ui while the game is loading
        scene.detachControl();

        //--INPUT--
        this._input = new PlayerInput(scene); //detect keyboard/mobile inputs

        //create a simple button
        const loseBtn = Button.CreateSimpleButton("lose", "LOSE");
        loseBtn.width = 0.2
        loseBtn.height = "40px";
        loseBtn.color = "white";
        loseBtn.top = "-14px";
        loseBtn.thickness = 0;
        loseBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        playerUI.addControl(loseBtn);

        //this handles interactions with the start button attached to the scene
        loseBtn.onPointerDownObservable.add(() => {
            this._goToLose();
            scene.detachControl(); //observables disabled
        });

        //primitive character and setting
        await this._initializeGameAsync(scene);
        
        //--WHEN SCENE FINISHED LOADING--
        await scene.whenReadyAsync();
        scene.getMeshByName("outer").position = new Vector3(0,3,0);
        //get rid of start scene, switch to gamescene and change states
        this._scene.dispose();
        this._state = State.GAME;
        this._scene = scene;
        this._engine.hideLoadingUI();
        //the game is ready, attach control back
        this._scene.attachControl();
    }

    private async _goToLose(): Promise<void> {
        this._engine.displayLoadingUI();

        //--SCENE SETUP--
        this._scene.detachControl();
        let scene = new Scene(this._engine);
        scene.clearColor = new Color4(0, 0, 0, 1);
        let camera = new FreeCamera("camera1", new Vector3(0, 0, 0), scene);
        camera.setTarget(Vector3.Zero());

        //--GUI--
        const guiMenu = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        const mainBtn = Button.CreateSimpleButton("mainmenu", "MAIN MENU");
        mainBtn.width = 0.2;
        mainBtn.height = "40px";
        mainBtn.color = "white";
        guiMenu.addControl(mainBtn);
        //this handles interactions with the start button attached to the scene
        mainBtn.onPointerUpObservable.add(() => {
            this._goToStart();
        });

        //--SCENE FINISHED LOADING--
        await scene.whenReadyAsync();
        this._engine.hideLoadingUI(); //when the scene is ready, hide loading
        //lastly set the current state to the lose state and set the scene to the lose scene
        this._scene.dispose();
        this._scene = scene;
        this._state = State.LOSE;
    }
}
new App();