import supabaseClient from "../utils/supabase";

export async function mailMiningComplete(miningId: string) {
	const { error } = await supabaseClient.functions.invoke(
		"mail/mining-complete",
		{
			method: "POST",
			body: {
				miningId,
			},
		},
	);

	if (error) {
		throw error;
	}
}
