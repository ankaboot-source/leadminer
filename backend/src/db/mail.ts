import supabaseClient from "../utils/supabase";

export async function mailMiningComplete(userId: string, miningId: string) {
	const { error } = await supabaseClient.functions.invoke(
		"mail/mining-complete",
		{
			method: "POST",
			body: {
				userId,
				miningId,
			},
		},
	);

	if (error) {
		throw error;
	}
}
