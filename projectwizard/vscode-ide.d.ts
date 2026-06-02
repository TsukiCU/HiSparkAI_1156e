/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// ide start
declare module 'vscode' {

	export enum ToolBarGroup {
		PROJECT_MANAGE = '0_project_manage',
		FILE_MANAGE = '1_file_manage',
		FILE_EDIT = '2_file_edit',
		PROJECT_COMPILE = '3_project_compile',
		PROJECT_DOWNLOAD = '4_project_download',
		PROJECT_DEBUG = '5_project_debug',
		OTHER = '6_other'
	}

	export interface ToolBarIconColor {
		dark: string;
		light: string;
	}

	/**
	 * A Tool bar item is a Tool bar contribution that can
	 * show text and icons and run a command on click.
	 */
	export interface ToolBarItem {

		/**
		 * The identifier for the entry like 'newProject',
		 * 'stackAnalysis' etc.
		 */
		readonly id: string;

		/**
		 * The name for the entry like 'New Project',
		 * 'Stack Analysis' etc.
		 */
		readonly name: string;

		/**
		 * The group identifier for the entry.
		 *
		 * Entries in same group will be shown
		 * next to each other in toolbar.
		 */
		readonly group: string | ToolBarGroup;

		/**
		 * The order for the entry to show in toolbar.
		 */
		readonly order: number;

		/**
		 * The icon for the entry to show in toolbar.
		 */
		icon: Uri;

		/**
		 * A description text to show when you hover over the entry
		 */
		description: string;

		/**
		 * {@linkcode Command} or identifier of a command to run on click.
		 *
		 * The command must be {@link commands.getCommands known}.
		 *
		 * Note that if this is a {@linkcode Command} object, only the {@linkcode Command.command command} and {@linkcode Command.arguments arguments}
		 * are used by the editor.
		 */
		command?: string | Command;

		/**
		 * An optional arg for command execution.
		 */
		arg?: string | string[];

		/**
		 * A shortcut for command execution.
		 */
		shortcut?: string;

		/**
		 * An optional color to use for the entry icon
		 */
		iconColor?: ToolBarIconColor;

		/**
		 * Shows the entry in the Tool bar.
		 */
		show: () => void;

		/**
		 * Hide the entry in the Tool bar.
		 */
		hide: () => void;

		/**
		 * Enable the entry in the Tool bar.
		 */
		enable: () => void;

		/**
		 * Disable the entry in the Tool bar.
		 */
		disable: () => void;

		/**
		 * Dispose and free associated resources. Call
		 * {@link ToolBarItem.hide hide}.
		 */
		dispose: () => void;
	}

  export interface MenuThemeIcon {

		/**
		 * Icon id.
		 */
		readonly id: string;
	}

  export interface CommandActionTitle {
		/**
		 * The localized value of the string.
		 */
		value: string;

		/**
		 * The original (non localized value of the string)
		 */
		original: string;

		/**
		 * The title with a mnemonic designation. && precedes the mnemonic.
		 */
		mnemonicTitle?: string;
	}

  export interface LocalizedString {
		/**
		 * The localized value of the string.
		 */
		value: string;

		/**
		 * The original (non localized value of the string)
		 */
		original: string;
	}

  export interface CommandAction {

		/**
		 * Command id.
		 */
		id: string;

		/**
		 * Title show on menu.
		 */
		title: string | CommandActionTitle;

		/**
		 * Short title show on menu.
		 */
		shortTitle?: string;

		/**
		 * Menu category in submenu.
		 */
		category?: string | LocalizedString;

		/**
		 * Tooltip title.
		 */
		tooltip?: string;

		/**
		 * Menu icon.
		 */
		icon?: MenuThemeIcon;

		/**
		 * Menu source.
		 */
		source?: string;

		/**
		 * ContextKey Expression.
		 */
		precondition?: string;

		/**
		 * ContextKey Expression.
		 */
		toggled?: string | { condition: string; icon?: MenuThemeIcon; tooltip?: string; title?: string };
    
	}

  export interface MenuItem { // 接口

		/**
		 * Command action.
		 */
		command: CommandAction; // 属性

		/**
		 * ContextKey Expression.
		 */
		when?: string;

		/**
		 * Menu show in group.
		 */
		group?: string;

		/**
		 * The menu shown order.
		 */
		order?: number;

    /**
       * Arguments passed to command, will be spreaded as rest parameters if this is an array
       */
    args?: any;

	}

	export interface SubmenuItem {

		/**
		 * Custom menu id.
		 */
		submenu: string;

		/**
		 * Title shown on menu.
		 */
		title: string;

		/**
		 * The title with a mnemonic designation. && precedes the mnemonic.
		 */
		mnemonicTitle?: string;

		/**
		 * ContextKey Expression.
		 */
		when?: string;

		/**
		 * Menu show in group.
		 */
		group?: string;

		/**
		 * The menu shown order.
		 */
		order?: number;
	}

	namespace window {

		/**
		 * Creates a Tool bar {@link ToolBarItem item}.
		 *
		 * @param id The unique identifier of the item.
		 * @param alignment The alignment of the item.
		 * @param priority The priority of the item. Higher values mean the item should be shown more to the left.
		 * @return A new Tool bar item.
		 */
		export function createToolBarItem(id: string, name: string, icon: Uri, description: string, group?: string | ToolBarGroup, order?: number): ToolBarItem;
	
        /**
		 * Register menu or submenu using menu id.
		 *
		 * *Note* that if the {@link id menuId} is not registered before, it will be registered automatically.
		 * Make sure a {@link id menuId} is already registered before using it.
		 *
		 * **Example:** Register a submenu 'Hello' in 'File' menu, and menu 'Command Palette' under 'Hello'.
		 * ```typescript
		 * // Register a menu 'Command Palette' under submenu 'Hello', the menuId 'HelloMenuId' will be registered automatically
		 * vscode.window.registerMenu('HelloMenuId', { command: { id: 'workbench.action.showCommands', title: 'Command Palette'} });
		 *
		 * // Register the submenu 'Hello' in 'File' menu for which the menuId is 'MenubarFileMenu'
		 * vscode.window.registerMenu('MenubarFileMenu', { submenu: 'HelloMenuId', title: 'Hello' });
		 * ```
		 *
		 * @param id Menu id.
		 * @param item The actual menu or submenu.
		 */
        export function registerMenu(id: string, item: MenuItem | SubmenuItem): void;

        export function hiSetProjectValue(projectKey: string, projectValue: string): void;

        export function hiGetProjectValue(projectKey: string): Promise<string | undefined>;  
  }
}

// ide end
