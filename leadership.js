export class swadeLeadership {
	
	/** This macro uses SUCC to set the Command, Fervor and Hold the Line! effects on
	 *  all tokens in range with the same disposition as the selected token. If no token
	 *  is selected, all Leadership effects are removed from all tokens.
	 */
	
	applyEffects(actor, token, options) {

		function hasEffect(token, effect) {
		  return token.actor.effects.find(e => e.name == effect) ? true : false;
		}

		function removeEffects(t, hasCommand, hasFervor, hasHoldTheLine) {
			let effects = []
			if (hasCommand)
				effects.push(game.swadeLeadership.commandEffect);
			if (hasFervor)
				effects.push(game.swadeLeadership.fervorEffect);
			if (hasHoldTheLine)
				effects.push(game.swadeLeadership.holdTheLineEffect);

			let deleteEffects = [];
			for (const eff of effects) {
				t.actor.effects.find(e => {
					if (e.name == eff.name) {
						deleteEffects.push(e._id);
					}
				});
			}

			t.actor.deleteEmbeddedDocuments("ActiveEffect", deleteEffects);
			return deleteEffects.length;
		}		

		if (options?.remove && !token) {
			let count = 0;
			for (let t of canvas.tokens.objects.children)
				if (removeEffects(t, true, true, true) > 0)
					count++;
			ui.notifications.notify(`Leadership effects removed from ${count} token${count == 1 ? '' : 's'}.`);
			return;
		}

		const hasCommand = actor.items.find(it => it.type == 'edge' && it.system.swid == 'command');
		const hasNaturalLeader = actor.items.find(it => it.type == 'edge' && it.system.swid == 'natural-leader');
		const hasFervor = actor.items.find(it => it.type == 'edge' && it.system.swid == 'fervor');
		const hasHoldTheLine = actor.items.find(it => it.type == 'edge' && it.system.swid == 'hold-the-line');

		const range = this.commandRange(actor);

		// Exit if no leadership.
		if (!(hasCommand || hasFervor || hasHoldTheLine)) {
			ui.notifications.notify(`${actor.name} has no applicable Leadership Edges.`);
			return;
		}

		if (options?.remove) {
			let allyCount = 0
			for (let t of canvas.tokens.objects.children) {
				if (this.canAffect(token, t, hasNaturalLeader)) {
					if (removeEffects(t, true, true, true) > 0)
						allyCount++;
				}
			}
			ui.notifications.notify(`Leadership effects removed for ${allyCount} all${allyCount == 1 ? 'y' : 'ies'} of ${actor.name}.`);
			return;
		}

		let allyCount = 0;
		for (let t of canvas.tokens.objects.children) {
		  // Can't affect self.
		  if (token.id == t.id)
			continue;

		  if (!this.canAffect(token, t, hasNaturalLeader))
			  continue

		  // Remove effects if they're out of range.

		  if (!this.inRange(range, token, t)) {
			removeEffects(t, hasCommand, hasFervor, hasHoldTheLine);
			continue;
		  }
		  
		  if (hasCommand)
			  this.setEffect(actor, t.actor, this.commandEffect);
		  if (hasFervor)
			  this.setEffect(actor, t.actor, this.fervorEffect);
		  if (hasHoldTheLine)
			  this.setEffect(actor, t.actor, this.holdTheLineEffect);
		  allyCount++;
		}
		ui.notifications.notify(`Leadership effects added to ${allyCount} all${allyCount == 1 ? 'y' : 'ies'} of ${actor.name}.`);
	}
	
	async setEffect(sourceActor, actor, effect) {
		if (actor.effects.find(e => e.name == effect.name))
			return;

		await actor.createEmbeddedDocuments("ActiveEffect", [effect]);	
	}

	commandEffect = {
		name: "Command",
		icon: "modules/swade-leadership/icons/inspire.webp",
		origin: null,
		disabled: false,
		duration: {
		  seconds: null,
		  rounds: null
		},
		system: {
			favorite: true,
			expiration: null
		},
		description: "<p>+1 unShake and Unstun bonus.</p>",
		changes: [
			{
				key: "system.attributes.spirit.unShakeBonus",
				mode: CONST.ACTIVE_EFFECT_MODES.ADD,
				value: 1
			},
			{
				key: "system.attributes.vigor.unStunBonus",
				mode: CONST.ACTIVE_EFFECT_MODES.ADD,
				value: 1
			}
		]
	};
	fervorEffect = {
		name: "Fervor",
		icon: "modules/swade-leadership/icons/fervor.webp",
		origin: null,
		disabled: false,
		duration: {
		  seconds: null,
		  rounds: null
		},
		system: {
			favorite: true,
			expiration: null
		},
		description: "<p>+1 to Fighting damage rolls.</p>",
		changes: [
			{
				key: "system.stats.globalMods.damage",
				mode: CONST.ACTIVE_EFFECT_MODES.ADD,
				value: 1
			}
		]
	};
	holdTheLineEffect = {
		name: "Hold the Line",
		icon: "modules/swade-leadership/icons/holdtheline.webp",
		origin: null,
		disabled: false,
		duration: {
		  seconds: null,
		  rounds: null
		},
		system: {
			favorite: true,
			expiration: null
		},
		description: "<p>+1 Toughness.</p>",
		changes: [
			{
				key: "system.stats.toughness.value",
				mode: CONST.ACTIVE_EFFECT_MODES.ADD,
				value: 1
			}
		]
	};

	commandRange(actor) {
		return actor.items.find(it => it.type == 'edge' && it.system.swid == 'command-presence') ? 10 : 5;
	}
	
	hasNaturalLeader(actor) {
		return actor.items.find(it => it.type == 'edge' && it.system.swid == 'natural-leader') ? true : false;
	}
	
	inRange(range, token, t) {
		const result = canvas.grid.measurePath([
			{x: token.x, y: token.y},
			{x: t.x, y: t.y}
		]);
		return result.distance <= range;
	}

	canAffect(token, t, hasNaturalLeader) {
		// Only affect tokens with same disposition.
		if (token.document.disposition != t.document.disposition)
			return false;
		// Don't affect wildcards unless actor has Natural Leader Edge.
		if (t.actor.system.wildcard && !hasNaturalLeader)
			return false;
		return true;
	}

	async addEffect(sourceActor, actor, name, icon, duration, expiration, changes) {

		const effectData = {
			name: name,
			icon: icon,
			origin: `Actor.${sourceActor.id}`,
			disabled: false,
			duration: {
			  seconds: duration === null ? null : duration * 6,
			  rounds: duration,
			  startTime: game.time.worldTime
			},
			system: {
			  expiration: expiration
			},
			changes: changes
		};

		// Apply the effect
		await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);	
	}
	
	
	async inspire(token, actor, options) {
		const attrlang={
			agility: "AttrAgi",
			spirit:"AttrSpr",
			strength: "AttrStr",
			smarts:  "AttrSma",
			vigor: "AttrVig"
		};
		let inspireEffect = {
			name: "Inspire (Trait +1)",
			icon: "modules/swade-leadership/icons/inspire.webp",
			origin: null,
			disabled: false,
			duration: {
			  seconds: null,
			  rounds: 1,
			  startRound: game?.combat?.current?.round
			},
			system: {
				favorite: true,
				expiration: 2
			},
			description: "<p>+1 to Trait.</p>",
			changes: [
			]
		};

		if (token == null) {
			ui.notifications.warn('A token with the Inspire Edge must be selected.');
			return;
		}

		if (!(actor.items.find(e => e.type == 'edge' && e.system.swid == 'inspire'))) {
			ui.notifications.notify(`${token.name} does not have the Inspire Edge.`);
			return;
		}

		if (options?.remove) {
			const origin = `Actor.${actor.id}`;
			for (let t of canvas.tokens.objects.children) {
				const eff = t.actor.effects.find(e => e.name.match(/^Inspire/) && e.origin == origin);
				if (eff)
					t.actor.deleteEmbeddedDocuments("ActiveEffect", [eff.id]);
			}
			return;
		}

		const hasNaturalLeader = actor.items.find(it => it.type == 'edge' && it.system.swid == 'natural-leader');
		const range = this.commandRange(actor);

		let tokens = [];

		for (let t of canvas.tokens.objects.children) {
			// Can't affect self.
			if (token.id == t.id)
				continue;

			if (!this.canAffect(token, t, hasNaturalLeader))
				continue

			if (this.inRange(range, token, t))
				tokens.push(t);
		}

		if (tokens.length < 1){
			ui.notifications.warn(`There are no allies within range of ${token.name} to apply Inspire to.`);
			return;
		}

		const attributes=['agility','smarts','spirit','strength','vigor']

		let skillList=[]
		let content=`<div><div>
			<p><label>${game.i18n.localize('SWADE.Trait')} </label> <select id="trait">\n`;

		content += `<optgroup label="${game.i18n.localize('SWADE.Attributes')}">\n`;
		attributes.map(att=>{
			content+=`<option value="att-${att}">${game.i18n.localize('SWADE.'+attrlang[att])}</option>\n`;
		})

		content+=`</optgroup>
		<optgroup label="${game.i18n.localize('SWADE.Skills')}">\n`

		tokens.map(token=>{
			token.actor.items.filter(el=>el.type=='skill').map(skill=>{
					if (!skillList.includes(skill.name)){
						content+=`<option value="${skill.name}">${skill.name}</option>\n`;
						skillList.push(skill.name);
					}
				}
			)
		});

		content += `</select></p>\n
			<p><label><input type="checkbox" id="raise" name="raise" value="Raise"> Raise on Battle roll.</label></p>
		</div></div>`;

		await foundry.applications.api.DialogV2.wait({
			window: {
				title: "Select Trait to Inspire",
			  position: {
				  width: 300,
				  height: 300
			  }
				
			},
			modal: true,
			content: content,
			buttons: [
				{
					action: "choice",
					label: "OK",
					callback: async (event, button, dialog) => {
						const trait = button.form.elements.trait.value;
						const raise = button.form.elements.raise.checked;
						let change;
						let traitName;
						if (trait.match(/^att-/)) {
							const traitId = trait.replace(/att-/, '');
							traitName = game.i18n.localize('SWADE.'+attrlang[traitId]);
							change = {
								key: `system.attributes.${traitId}.die.modifier`,
								mode: CONST.ACTIVE_EFFECT_MODES.ADD,
								value: raise ? 2 : 1
							};
						} else {
							traitName = trait;
							change = {
								key: `@Skill{${trait}}[system.die.modifier]`,
								mode: CONST.ACTIVE_EFFECT_MODES.ADD,
								value: raise ? 2 : 1
							};
						}
						inspireEffect.changes.push(change);
						inspireEffect.name = `Inspire (${traitName})`;
						inspireEffect.description = `<p>+${raise ? 2 : 1} to ${traitName}</p>`;
						inspireEffect.origin =`Actor.${actor.id}`;

						for (const t of tokens) {
							await t.actor.createEmbeddedDocuments("ActiveEffect", [inspireEffect]);	
						}
					}
				},
				{
					action: "cancel",
					label: "Cancel",
					callback: (event, button, dialog) => null
				}
			]
		});
	}

	static {
		console.log("swade-leadership | loaded.");

		Hooks.on("init", function() {
			console.log("swade-leadership | initialized.");
			if (!game.swadeLeadership) {
				game.swadeLeadership = new swadeLeadership();
			}
		});
	}

}


Hooks.once("setup", () => {
  game.keybindings.register("swade-leadership", "apply-leadership-key", {
    name: "Leadership Effects",
    hint: "Apply Leadership effects on selected token to allies within range.",
    editable: [{ key: 'KeyK' }],
    restricted: false,
    onDown: applyLeadership
  });
  game.keybindings.register("swade-leadership", "remove-leadership-key", {
    name: "Remove Leadership Effects",
    hint: "Remove Leadership effects granted by selected token from allies.",
    editable: [
		{
			key: 'KeyK',
			modifiers: ['Shift']
		}
	],
    restricted: false,
    onDown: removeLeadership
  });
  
  function applyLeadership(event) {
	switch (canvas.tokens.controlled.length) {
	case 1:
		const token = canvas.tokens.controlled[0];
		game.swadeLeadership.applyEffects(token.actor, token);
		break;
	default:
		ui.notifications.notify("Select one token with Leadership to apply the effects.");
		break;
	}	
  }

  function removeLeadership(event) {
	switch (canvas.tokens.controlled.length) {
	case 1:
		const token = canvas.tokens.controlled[0];
		game.swadeLeadership.applyEffects(token.actor, token, {remove: true});
		break;
	case 0:
		game.swadeLeadership.applyEffects(null, null, {remove: true});
		break;
	default:
		ui.notifications.notify("Select one token with Leadership to apply the effects.");
		break;
	}	
  }
});
