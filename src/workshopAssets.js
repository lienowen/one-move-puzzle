// Code-ready asset map for One Move Puzzle.
// Vite must see these files during build; plain '/assets/...' strings are not enough.
const workshopModules = import.meta.glob('../assets/workshop/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

function asset(relativePath) {
  const key = `../assets/workshop/${relativePath}`;
  const url = workshopModules[key];
  if (!url) {
    console.error(`[workshop-assets] Missing bundled asset: ${key}`);
    return '';
  }
  return url;
}

export const WORKSHOP_ASSETS = {
  base: {
    boardWorkshopBase: asset('base/board_workshop_base.png'),
    boardSidePanel: asset('base/board_side_panel.png'),
    boardCornerCap: asset('base/board_corner_cap.png'),
  },
  tracks: {
    trackStraight: asset('tracks/track_straight.png'),
    trackCurveLeft: asset('tracks/track_curve_left.png'),
    trackCurveRight: asset('tracks/track_curve_right.png'),
    trackSCurve: asset('tracks/track_s_curve.png'),
    trackEnd: asset('tracks/track_end.png'),
    trackT: asset('tracks/track_t.png'),
    trackHalfStraight: asset('tracks/track_half_straight.png'),
    trackJoiner: asset('tracks/track_joiner.png'),
    trackForkLeft: asset('tracks/track_fork_left.png'),
    trackForkRight: asset('tracks/track_fork_right.png'),
    trackCross: asset('tracks/track_cross.png'),
    trackBridge: asset('tracks/track_bridge.png'),
    trackRiserShort: asset('tracks/track_riser_short.png'),
    trackRiserTall: asset('tracks/track_riser_tall.png'),
    trackDropGate: asset('tracks/track_drop_gate.png'),
    trackSpinnerSwitch: asset('tracks/track_spinner_switch.png'),
    trackFlipFlap: asset('tracks/track_flip_flap.png'),
    trackFunnel: asset('tracks/track_funnel.png'),
    trackCurveTightLeft: asset('tracks/track_curve_tight_left.png'),
    trackCurveTightRight: asset('tracks/track_curve_tight_right.png'),
    trackCurveWideLeft: asset('tracks/track_curve_wide_left.png'),
    trackCurveWideRight: asset('tracks/track_curve_wide_right.png'),
  },
  pins: {
    ballHolder: asset('pins/ball_holder.png'),
    pinBlue: asset('pins/pin_blue.png'),
    pinRed: asset('pins/pin_red.png'),
    pinSocket: asset('pins/pin_socket.png'),
    pinEnd: asset('pins/pin_end.png'),
  },
  hardware: {
    bracketCorner: asset('hardware/bracket_corner.png'),
    bracketStraight: asset('hardware/bracket_straight.png'),
    bracketU: asset('hardware/bracket_u.png'),
    screw: asset('hardware/screw.png'),
    screwCap: asset('hardware/screw_cap.png'),
    metalPlate: asset('hardware/metal_plate.png'),
    postWood: asset('hardware/post_wood.png'),
    postMetal: asset('hardware/post_metal.png'),
    chainShort: asset('hardware/chain_short.png'),
    chainLong: asset('hardware/chain_long.png'),
  },
  mechanisms: {
    buttonYellow: asset('mechanisms/button_yellow.png'),
    buttonGreen: asset('mechanisms/button_green.png'),
    leverRed: asset('mechanisms/lever_red.png'),
    leverBlue: asset('mechanisms/lever_blue.png'),
    springBumper: asset('mechanisms/spring_bumper.png'),
    gear: asset('mechanisms/gear.png'),
    wheelValve: asset('mechanisms/wheel_valve.png'),
    bell: asset('mechanisms/bell.png'),
    fan: asset('mechanisms/fan.png'),
    conveyor: asset('mechanisms/conveyor.png'),
    magnet: asset('mechanisms/magnet.png'),
    portal: asset('mechanisms/portal.png'),
    gateSlider: asset('mechanisms/gate_slider.png'),
    gateLockedRound: asset('mechanisms/gate_locked_round.png'),
    pistonPusher: asset('mechanisms/piston_pusher.png'),
    hammerStriker: asset('mechanisms/hammer_striker.png'),
    springPadSmall: asset('mechanisms/spring_pad_small.png'),
    bumperRound: asset('mechanisms/bumper_round.png'),
    bumperTriangle: asset('mechanisms/bumper_triangle.png'),
    lampIndicatorGreen: asset('mechanisms/lamp_indicator_green.png'),
    lampIndicatorRed: asset('mechanisms/lamp_indicator_red.png'),
    checkpointRing: asset('mechanisms/checkpoint_ring.png'),
    crankHandle: asset('mechanisms/crank_handle.png'),
    pulleySingle: asset('mechanisms/pulley_single.png'),
    pulleyDouble: asset('mechanisms/pulley_double.png'),
    ropeHook: asset('mechanisms/rope_hook.png'),
  },
  goals: {
    goalSocket: asset('goals/goal_socket.png'),
    goalYellow: asset('goals/goal_yellow.png'),
    star: asset('goals/star.png'),
    ballBlue: asset('goals/ball_blue.png'),
    ballSteel: asset('goals/ball_steel.png'),
    starSocket: asset('goals/star_socket.png'),
    coinBrass: asset('goals/coin_brass.png'),
  },
  decor: {
    crateWood: asset('decor/crate_wood.png'),
    stopperWood: asset('decor/stopper_wood.png'),
    signArrow: asset('decor/sign_arrow.png'),
    flagBlue: asset('decor/flag_blue.png'),
    signStart: asset('decor/sign_start.png'),
    signGoal: asset('decor/sign_goal.png'),
  },
};

export default WORKSHOP_ASSETS;
