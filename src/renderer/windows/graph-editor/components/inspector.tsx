import { Nullable } from "../../../../shared/types";

import * as React from "react";
import { GUI, GUIParams, GUIController } from "dat.gui";

import { LGraphGroup, LiteGraph } from "litegraph.js";

import "../../../editor/gui/augmentations/index";

import { GraphNode } from "../../../editor/graph/node";

import { Tools } from "../../../editor/tools/tools";

import GraphEditorWindow from "../index";
import { Vector3, Color4 } from "babylonjs";

export interface IInspectorProps {
    /**
     * Defines the reference to the editor's window main class.
     */
    editor: GraphEditorWindow;
}

export class Inspector extends React.Component<IInspectorProps> {
    /**
     * Defines the reference to the dat.gui tool.
     */
    public tool: Nullable<GUI> = null;
    /**
     * Defines the reference to the current node being edited.
     */
    public node: Nullable<GraphNode> = null;

    private _toolDiv: HTMLDivElement;
    private _refHandler = {
        getToolDiv: (ref: HTMLDivElement) => this._toolDiv = ref,
    };

    private _shape: string = "";

    /**
     * Constructor.
     * @param props defines the component's props.
     */
    public constructor(props: IInspectorProps) {
        super(props);

        props.editor.inspector = this;
    }

    /**
     * Renders the component.
     */
    public render(): React.ReactNode {
        return <div ref={this._refHandler.getToolDiv} style={{ width: "100%", height: "100%" }}></div>;
    }

    /**
     * Called on the component did moubnt.
     */
    public componentDidMount(): void {
        this.tool = new GUI({ autoPlace: false, scrollable: true } as GUIParams);
        this._toolDiv.appendChild(this.tool.domElement);
    }

    /**
     * Called on the window or layout is resized.
     */
    public resize(): void {
        this.tool!.width = this.props.editor.getPanelSize("inspector").width;
    }

    /**
     * Sets the node to edit.
     * @param node defines the reference to the node to edit.
     */
    public async setNode(node: GraphNode): Promise<void> {
        
        this.resize();
        this._clear();
        
        this.node = node;
        this.node.onWidgetChange = () => this.setNode(node);

        // Configure
        node.bgcolor = node.bgcolor ?? LiteGraph.NODE_DEFAULT_BGCOLOR;
        node.boxcolor = node.boxcolor ?? LiteGraph.NODE_DEFAULT_BOXCOLOR;
        node.shape = node.shape ?? LiteGraph.ROUND_SHAPE;

        // Functions
        const functions = this.tool!.addFolder("Functions");
        functions.open();
        functions.addButton("Focus").onClick(() => node.focusOn());

        // Common
        const common = this.tool!.addFolder("Common");
        common.open();
        common.add(node, "title");

        const shapes: string[] = ["BOX_SHAPE", "ROUND_SHAPE", "CIRCLE_SHAPE", "CARD_SHAPE", "ARROW_SHAPE"];
        this._shape = shapes.find((s) => node.shape === LiteGraph[s])!;
        common.addSuggest(this, "_shape", shapes).name("Shape").onChange(() => {
            node.shape = LiteGraph[this._shape];
            node.setDirtyCanvas(true, true);
        });

        // Colors
        const colors = this.tool!.addFolder("Colors");
        colors.open();
        colors.addColor(node, "bgcolor").name("Background Color").onChange(() => node.setDirtyCanvas(true, true));
        colors.addColor(node, "boxcolor").name("Box Color").onChange(() => node.setDirtyCanvas(true, true));

        // Properties
        const properties = this.tool!.addFolder("Properties");
        properties.open();

        // Add properties only
        for (const p in node.properties) {
            const value = node.properties[p];
            const ctor = Tools.GetConstructorName(value).toLowerCase();

            const widget = node.widgets?.find((w) => w.name === p);
            if (widget?.options?.values) {
                const values = (typeof(widget.options.values) === "function") ? widget.options.values() : widget.options.values;
                properties.addSuggest(node.properties, p, values).name(this._getFormatedname(p)).onChange((r) => {
                    node.setDirtyCanvas(true, true);
                    node.onPropertyChange(p, r);
                });
                continue;
            }

            let controller: Nullable<GUIController> = null;
            switch (ctor) {
                case "number":
                case "string":
                case "boolean":
                    controller = properties.add(node.properties, p).onChange((r) => {
                        node.setDirtyCanvas(true, true);
                        node.onPropertyChange(p, r);
                    }).name(this._getFormatedname(p));
                    break;
                case "vector2":
                case "vector3":
                    properties.addVector(this._getFormatedname(p), value).onChange(() => {
                        node.setDirtyCanvas(true, true);
                        node.onPropertyChange("value.x", value.x);
                        node.onPropertyChange("value.y", value.y);

                        if (value instanceof Vector3) {
                            node.onPropertyChange("value.z", value.z);
                        }
                    });
                    break;
                case "color3":
                    properties.addColor(this._getFormatedname(p), value).onChange(() => {
                        node.setDirtyCanvas(true, true);
                        node.onPropertyChange("value.r", value.r);
                        node.onPropertyChange("value.g", value.g);
                        node.onPropertyChange("value.b", value.b);

                        if (value instanceof Color4) {
                            node.onPropertyChange("value.a", value.a);
                        }
                    });
                    break;
            }

            if (controller && widget) {
                if (widget.options?.min) { controller.min(widget.options.min); }
                if (widget.options?.max) { controller.max(widget.options.max); }
                if (widget.options?.step) { controller.step(widget.options.step); }
            }
        }
    }

    /**
     * Sets the group to edit.
     * @param group defines the reference to the group.
     */
    public setGroup(group: LGraphGroup): void {
        this.resize();
        this._clear();

        const folder = this.tool!.addFolder("Group");
        folder.open();

        folder.add(group, "title").onChange(() => this.props.editor.graph.graphCanvas?.setDirty(true, true));
    }

    /**
     * Clears the tool.
     */
    private _clear(): void {
        if (this.node) { this.node.onWidgetChange = null; }
        this.node = null;

        if (!this.tool) { return; }

        while (this.tool.__controllers.length) {
            this.tool.remove(this.tool.__controllers[0]);
        }

        for (const key in this.tool.__folders) {
            this.tool.removeFolder(this.tool.__folders[key]);
        }
    }

    /**
     * Returns the name of the folder or node in its formated form.
     */
    private _getFormatedname(name: string): string {
        return name[0].toUpperCase() + name.substr(1, name.length - 1).replace(/_/g, " ");
    }
}